-- Snapshot de funções operacionais implantadas, somente para testes locais.
-- Sem pedidos ou dados de clientes. Não é uma migração a aplicar.

CREATE OR REPLACE FUNCTION delivery_private.order_json(o delivery_orders)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select o.payload || jsonb_build_object('id',o.id,'siteId',o.store_id,'orderNumber',o.order_number,'total',o.total_cents/100.0,'status',o.status,'isPaid',o.is_paid,'paymentStatus',case when o.is_paid then 'paid' else 'pending' end,'createdAt',o.created_at,'updatedAt',o.updated_at);
$function$;


CREATE OR REPLACE FUNCTION delivery_private.place_order(p_store_id uuid, p_request jsonb, p_idempotency_key uuid, p_access_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cfg jsonb; line jsonb; product public.delivery_products; addon jsonb; chosen jsonb; removal jsonb;
  unit_cents bigint; subtotal bigint:=0; fee bigint; v_discount bigint:=0; v_coupon_code text; v_coupon public.delivery_coupons%rowtype; qty integer; total_qty integer:=0;
  cooked jsonb:='[]'; addons jsonb; clean_items jsonb; o public.delivery_orders; customer jsonb;
  token_hash text; input_hash text; phone text; v_phone_hash text; safe_request jsonb;
begin
  if p_access_token is null or p_access_token !~ '^[0-9a-f]{64}$' or p_idempotency_key is null then raise exception 'INVALID_ORDER_TOKEN'; end if;
  if p_request is null or jsonb_typeof(p_request)<>'object' or octet_length(p_request::text)>40000 then raise exception 'INVALID_ORDER'; end if;
  token_hash:=encode(sha256(convert_to(p_access_token,'UTF8')),'hex');
  input_hash:=encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text,1));
  select * into o from public.delivery_orders where store_id=p_store_id and idempotency_key=p_idempotency_key;
  if found then
    if o.access_hash<>token_hash or o.request_hash<>input_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return delivery_private.order_json(o);
  end if;
  if not delivery_private.store_is_public(p_store_id) then raise exception 'STORE_UNAVAILABLE'; end if;
  select payload into cfg from public.delivery_settings where store_id=p_store_id;
  if cfg is null or coalesce((cfg->>'isOpen')::boolean,false)=false or not delivery_private.schedule_is_open(cfg) then raise exception 'STORE_CLOSED'; end if;
  if length(btrim(coalesce(p_request->>'customerName',''))) not between 2 and 160 then raise exception 'INVALID_CUSTOMER'; end if;
  phone:=regexp_replace(coalesce(p_request->>'customerPhone',''),'[^0-9]','','g');
  if length(phone) not between 10 and 15 then raise exception 'INVALID_PHONE'; end if;
  v_phone_hash:=encode(sha256(convert_to(phone,'UTF8')),'hex');
  if coalesce(length(p_request->'deliveryAddress'->>'street'),0) not between 1 and 200
    or coalesce(length(p_request->'deliveryAddress'->>'number'),0) not between 1 and 30
    or coalesce(length(p_request->'deliveryAddress'->>'neighborhood'),0) not between 1 and 120
    or coalesce(length(p_request->'deliveryAddress'->>'complement'),0)>200
    or coalesce(length(p_request->>'notes'),0)>1000 then raise exception 'INVALID_ADDRESS_OR_NOTES'; end if;
  if p_request->>'paymentMethod' not in ('pix','credit_card','cash') or not coalesce(cfg->'acceptedPaymentMethods' ? (p_request->>'paymentMethod'),false) then raise exception 'INVALID_PAYMENT'; end if;
  if (select count(*) from public.delivery_orders where store_id=p_store_id and customer_phone_hash=v_phone_hash and created_at>now()-interval '10 minutes')>=3
    or (select count(*) from public.delivery_orders where store_id=p_store_id and created_at>now()-interval '10 minutes')>=100 then raise exception 'ORDER_RATE_LIMIT'; end if;
  clean_items:=p_request->'items';
  if clean_items is null or jsonb_typeof(clean_items)<>'array' or jsonb_array_length(clean_items) not between 1 and 30 then raise exception 'INVALID_ITEMS'; end if;
  for line in select value from jsonb_array_elements(clean_items) loop
    qty:=(line->>'quantity')::integer;
    if qty is null or qty not between 1 and 20 then raise exception 'INVALID_QUANTITY'; end if;
    total_qty:=total_qty+qty;
    if total_qty>100 or coalesce(length(line->>'notes'),0)>500 then raise exception 'ORDER_TOO_LARGE'; end if;
    select p.* into product from public.delivery_products p join public.delivery_categories c on c.store_id=p.store_id and c.id=p.category_id
      where p.store_id=p_store_id and p.id=line->>'productId' and p.is_active and c.is_active;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    unit_cents:=product.price_cents; addons:='[]';
    if jsonb_typeof(coalesce(line->'selectedAddons','[]'))<>'array' or jsonb_array_length(coalesce(line->'selectedAddons','[]'))>20 then raise exception 'INVALID_ADDONS'; end if;
    if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(coalesce(line->'selectedAddons','[]')) x) then raise exception 'DUPLICATE_ADDONS'; end if;
    for chosen in select value from jsonb_array_elements(coalesce(line->'selectedAddons','[]')) loop
      select value into addon from jsonb_array_elements(coalesce(product.payload->'addons','[]')) where value->>'id'=chosen->>'id';
      if addon is null or coalesce((addon->>'price')::numeric,-1)<0 then raise exception 'INVALID_ADDON'; end if;
      unit_cents:=unit_cents+round((addon->>'price')::numeric*100);
      addons:=addons||jsonb_build_array(jsonb_build_object('id',addon->>'id','name',addon->>'name','price',(addon->>'price')::numeric));
    end loop;
    if line ? 'meatPoint' and line->>'meatPoint' not in ('ao-ponto','bem-passado','mal-passado') then raise exception 'INVALID_MEAT_POINT'; end if;
    if jsonb_typeof(coalesce(line->'removals','[]'))<>'array' or jsonb_array_length(coalesce(line->'removals','[]'))>30 then raise exception 'INVALID_REMOVALS'; end if;
    for removal in select value from jsonb_array_elements(coalesce(line->'removals','[]')) loop
      if not coalesce(product.payload->'removableIngredients' @> jsonb_build_array(removal),false) then raise exception 'INVALID_REMOVAL'; end if;
    end loop;
    cooked:=cooked||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('productId',product.id,'name',product.payload->>'name','price',unit_cents/100.0,'quantity',qty,'imageUrl',product.payload->>'imageUrl','notes',line->>'notes','meatPoint',line->>'meatPoint','removals',coalesce(line->'removals','[]'),'selectedAddons',addons)));
    subtotal:=subtotal+unit_cents*qty;
  end loop;
  fee:=round(coalesce((cfg->>'deliveryFee')::numeric,0)*100);
  v_coupon_code:=upper(btrim(coalesce(p_request->>'couponCode','')));
  if v_coupon_code<>'' then
    if v_coupon_code !~ '^[A-Z0-9_-]{3,30}$' then raise exception 'INVALID_COUPON'; end if;
    select * into v_coupon from public.delivery_coupons where store_id=p_store_id and code=v_coupon_code and active for update;
    if not found or (v_coupon.expires_at is not null and v_coupon.expires_at<now())
      or (v_coupon.max_uses is not null and v_coupon.used_count>=v_coupon.max_uses)
      or subtotal < round(v_coupon.min_order*100) then raise exception 'COUPON_UNAVAILABLE'; end if;
    if v_coupon.discount_type='percent' then v_discount:=round(subtotal*v_coupon.discount_value/100);
    else v_discount:=round(v_coupon.discount_value*100); end if;
    v_discount:=least(subtotal,greatest(0,v_discount));
  end if;
  safe_request:=jsonb_strip_nulls(jsonb_build_object('customerName',btrim(p_request->>'customerName'),'customerPhone',phone,'deliveryAddress',p_request->'deliveryAddress','paymentMethod',p_request->>'paymentMethod','paymentChange',left(p_request->>'paymentChange',30),'notes',p_request->>'notes','items',cooked,'subtotal',subtotal/100.0,'deliveryFee',fee/100.0,'discount',v_discount/100.0,'couponCode',nullif(v_coupon_code,''),'estimatedMinutes',40));
  insert into public.delivery_orders(store_id,idempotency_key,access_hash,request_hash,customer_phone_hash,total_cents,payload)
    values(p_store_id,p_idempotency_key,token_hash,input_hash,v_phone_hash,subtotal+fee-v_discount,safe_request) returning * into o;
  customer:=jsonb_build_object('name',p_request->>'customerName','phone',phone,'address',(p_request->'deliveryAddress'->>'street')||', '||(p_request->'deliveryAddress'->>'number'),'totalOrders',1,'totalSpent',(subtotal+fee-v_discount)/100.0,'lastOrderAt',o.created_at);
  insert into public.delivery_customers(store_id,phone_hash,payload) values(p_store_id,v_phone_hash,customer)
    on conflict(store_id,phone_hash) do update set payload=excluded.payload||jsonb_build_object('totalOrders',coalesce((delivery_customers.payload->>'totalOrders')::integer,0)+1,'totalSpent',coalesce((delivery_customers.payload->>'totalSpent')::numeric,0)+(subtotal+fee-v_discount)/100.0);
  if v_coupon_code<>'' then update public.delivery_coupons set used_count=used_count+1 where store_id=p_store_id and code=v_coupon_code; end if;
  return delivery_private.order_json(o);
end;
$function$;

