-- PROPOSTA LOCAL. NÃO APLICADA. Revisar snapshot implantado antes de promover.
-- Não cria lojas/tabelas nem altera RLS. Reutiliza estoque, preços, cupons,
-- rate limit, idempotência e validações da função operacional atual.
begin;

create or replace function delivery_private.premium_schedule_enabled(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.managed_sites where id=target and status='active' and plan_code='NOVAES_PREMIUM');
$$;
revoke all on function delivery_private.premium_schedule_enabled(uuid) from public,anon,authenticated;

create function public.delivery_premium_features(p_store_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('coupons',delivery_private.premium_schedule_enabled(p_store_id),'scheduling',delivery_private.premium_schedule_enabled(p_store_id));
$$;
revoke all on function public.delivery_premium_features(uuid) from public,anon,authenticated;
grant execute on function public.delivery_premium_features(uuid) to anon,authenticated;

-- Preserve data/history; only owner/admin of an active Premium store can mutate coupons.
drop policy if exists coupons_owner_insert on public.delivery_coupons;
drop policy if exists coupons_owner_update on public.delivery_coupons;
drop policy if exists coupons_owner_delete on public.delivery_coupons;
create policy coupons_owner_insert on public.delivery_coupons for insert to authenticated
  with check(public.delivery_has_role(store_id,array['owner','admin']) and exists(select 1 from public.managed_sites s where s.id=store_id and s.plan_code='NOVAES_PREMIUM'));
create policy coupons_owner_update on public.delivery_coupons for update to authenticated
  using(public.delivery_has_role(store_id,array['owner','admin']) and exists(select 1 from public.managed_sites s where s.id=store_id and s.plan_code='NOVAES_PREMIUM'))
  with check(public.delivery_has_role(store_id,array['owner','admin']) and exists(select 1 from public.managed_sites s where s.id=store_id and s.plan_code='NOVAES_PREMIUM'));
create policy coupons_owner_delete on public.delivery_coupons for delete to authenticated
  using(public.delivery_has_role(store_id,array['owner','admin']) and exists(select 1 from public.managed_sites s where s.id=store_id and s.plan_code='NOVAES_PREMIUM'));

create or replace function delivery_private.schedule_open_at(cfg jsonb, at_time timestamptz)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  local_time timestamp := at_time at time zone 'America/Sao_Paulo';
  day_num integer := extract(dow from local_time);
  minute_num integer := extract(hour from local_time)*60+extract(minute from local_time);
  hours jsonb; start_min integer; end_min integer; offset_day integer;
begin
  -- Closed manually means no new scheduled requests. Weekly hours are mandatory.
  if coalesce((cfg->>'isOpen')::boolean,false)=false or coalesce((cfg->>'autoHoursEnabled')::boolean,false)=false then return false; end if;
  for offset_day in 0..1 loop
    hours := cfg->'weeklySchedule'->(((day_num-offset_day+7)%7)::text);
    if coalesce((hours->>'enabled')::boolean,false) and hours->>'open' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and hours->>'close' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      start_min:=split_part(hours->>'open',':',1)::integer*60+split_part(hours->>'open',':',2)::integer;
      end_min:=split_part(hours->>'close',':',1)::integer*60+split_part(hours->>'close',':',2)::integer;
      if offset_day=0 and (start_min=end_min or (start_min<end_min and minute_num>=start_min and minute_num<end_min) or (start_min>end_min and minute_num>=start_min)) then return true; end if;
      if offset_day=1 and start_min>end_min and minute_num<end_min then return true; end if;
    end if;
  end loop;
  return false;
end;
$$;
revoke all on function delivery_private.schedule_open_at(jsonb,timestamptz) from public,anon,authenticated;

create or replace function public.delivery_schedule_options(p_store_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cfg jsonb; slots jsonb;
begin
  if not delivery_private.premium_schedule_enabled(p_store_id) then return jsonb_build_object('enabled',false); end if;
  select payload into cfg from public.delivery_settings where store_id=p_store_id;
  if cfg is null or not coalesce((cfg->>'isOpen')::boolean,false) or not coalesce((cfg->>'autoHoursEnabled')::boolean,false) then return jsonb_build_object('enabled',false); end if;
  select coalesce(jsonb_agg(slot order by slot),'[]'::jsonb) into slots
  from generate_series(to_timestamp(ceil(extract(epoch from now()+interval '45 minutes')/900)*900), now()+interval '7 days', interval '15 minutes') slot
  where delivery_private.schedule_open_at(cfg,slot) and delivery_private.schedule_open_at(cfg,slot-interval '30 minutes');
  return jsonb_build_object('enabled',true,'server_now',now(),'slots',slots,'preparation_minutes',30,'fulfillment_modes',jsonb_build_array('delivery','pickup'));
end;
$$;
revoke all on function public.delivery_schedule_options(uuid) from public;
grant execute on function public.delivery_schedule_options(uuid) to anon,authenticated,service_role;

create or replace function delivery_private.validate_schedule(target uuid,cfg jsonb,request jsonb)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare scheduled_at timestamptz;
begin
  if not delivery_private.premium_schedule_enabled(target) then raise exception 'SCHEDULING_UNAVAILABLE'; end if;
  if coalesce(request->>'fulfillmentMode','delivery') not in ('delivery','pickup') then raise exception 'INVALID_FULFILLMENT_MODE'; end if;
  begin scheduled_at:=(request->>'scheduledFor')::timestamptz; exception when others then raise exception 'INVALID_SCHEDULE'; end;
  if scheduled_at is null or not isfinite(scheduled_at) or scheduled_at<now()+interval '45 minutes' or scheduled_at>now()+interval '7 days'
    or mod(extract(epoch from scheduled_at),900)<>0 or not delivery_private.schedule_open_at(cfg,scheduled_at)
    or not delivery_private.schedule_open_at(cfg,scheduled_at-interval '30 minutes') then raise exception 'SCHEDULE_UNAVAILABLE'; end if;
  return scheduled_at;
end;
$$;
revoke all on function delivery_private.validate_schedule(uuid,jsonb,jsonb) from public,anon,authenticated;

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
  token_hash text; input_hash text; phone text; v_phone_hash text; safe_request jsonb; scheduled_at timestamptz;
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
  if p_request ? 'scheduledFor' then
    scheduled_at:=delivery_private.validate_schedule(p_store_id,cfg,p_request);
  elsif cfg is null or coalesce((cfg->>'isOpen')::boolean,false)=false or not delivery_private.schedule_is_open(cfg) then raise exception 'STORE_CLOSED'; end if;
  if length(btrim(coalesce(p_request->>'customerName',''))) not between 2 and 160 then raise exception 'INVALID_CUSTOMER'; end if;
  phone:=regexp_replace(coalesce(p_request->>'customerPhone',''),'[^0-9]','','g');
  if length(phone) not between 10 and 15 then raise exception 'INVALID_PHONE'; end if;
  v_phone_hash:=encode(sha256(convert_to(phone,'UTF8')),'hex');
  if (scheduled_at is null or coalesce(p_request->>'fulfillmentMode','delivery')<>'pickup') and (coalesce(length(p_request->'deliveryAddress'->>'street'),0) not between 1 and 200
    or coalesce(length(p_request->'deliveryAddress'->>'number'),0) not between 1 and 30
    or coalesce(length(p_request->'deliveryAddress'->>'neighborhood'),0) not between 1 and 120
    or coalesce(length(p_request->'deliveryAddress'->>'complement'),0)>200
    or coalesce(length(p_request->>'notes'),0)>1000) then raise exception 'INVALID_ADDRESS_OR_NOTES'; end if;
  if coalesce(length(p_request->>'notes'),0)>1000 then raise exception 'INVALID_ADDRESS_OR_NOTES'; end if;
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
  fee:=case when scheduled_at is not null and p_request->>'fulfillmentMode'='pickup' then 0 else round(coalesce((cfg->>'deliveryFee')::numeric,0)*100) end;
  v_coupon_code:=upper(btrim(coalesce(p_request->>'couponCode','')));
  if v_coupon_code<>'' then
    if not delivery_private.premium_schedule_enabled(p_store_id) then raise exception 'COUPON_UNAVAILABLE'; end if;
    if v_coupon_code !~ '^[A-Z0-9_-]{3,30}$' then raise exception 'INVALID_COUPON'; end if;
    select * into v_coupon from public.delivery_coupons where store_id=p_store_id and code=v_coupon_code and active for update;
    if not found or (v_coupon.starts_at is not null and v_coupon.starts_at>now())
      or (v_coupon.expires_at is not null and v_coupon.expires_at<now())
      or (v_coupon.max_uses is not null and v_coupon.used_count>=v_coupon.max_uses)
      or subtotal < round(v_coupon.min_order*100) then raise exception 'COUPON_UNAVAILABLE'; end if;
    if v_coupon.discount_type='percent' then v_discount:=round(subtotal*v_coupon.discount_value/100);
    else v_discount:=round(v_coupon.discount_value*100); end if;
    v_discount:=least(subtotal,greatest(0,v_discount));
  end if;
  safe_request:=jsonb_strip_nulls(jsonb_build_object('customerName',btrim(p_request->>'customerName'),'customerPhone',phone,'deliveryAddress',p_request->'deliveryAddress','paymentMethod',p_request->>'paymentMethod','paymentChange',left(p_request->>'paymentChange',30),'notes',p_request->>'notes','items',cooked,'subtotal',subtotal/100.0,'deliveryFee',fee/100.0,'discount',v_discount/100.0,'couponCode',nullif(v_coupon_code,''),'estimatedMinutes',40));
  if scheduled_at is not null then safe_request:=safe_request||jsonb_build_object('scheduledFor',scheduled_at,'preparationMinutes',30,'fulfillmentMode',coalesce(p_request->>'fulfillmentMode','delivery')); end if;
  insert into public.delivery_orders(store_id,idempotency_key,access_hash,request_hash,customer_phone_hash,total_cents,payload)
    values(p_store_id,p_idempotency_key,token_hash,input_hash,v_phone_hash,subtotal+fee-v_discount,safe_request) returning * into o;
  customer:=jsonb_build_object('name',p_request->>'customerName','phone',phone,'address',(p_request->'deliveryAddress'->>'street')||', '||(p_request->'deliveryAddress'->>'number'),'totalOrders',1,'totalSpent',(subtotal+fee-v_discount)/100.0,'lastOrderAt',o.created_at);
  insert into public.delivery_customers(store_id,phone_hash,payload) values(p_store_id,v_phone_hash,customer)
    on conflict(store_id,phone_hash) do update set payload=excluded.payload||jsonb_build_object('totalOrders',coalesce((delivery_customers.payload->>'totalOrders')::integer,0)+1,'totalSpent',coalesce((delivery_customers.payload->>'totalSpent')::numeric,0)+(subtotal+fee-v_discount)/100.0);
  if v_coupon_code<>'' then update public.delivery_coupons set used_count=used_count+1 where store_id=p_store_id and code=v_coupon_code; end if;
  return delivery_private.order_json(o);
end;
$function$;

-- The existing immediate RPC remains unchanged; both RPCs delegate the same core.
create or replace function public.delivery_place_scheduled_order(p_store_id uuid,p_request jsonb,p_idempotency_key uuid,p_access_token text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if not (p_request ? 'scheduledFor') then raise exception 'INVALID_SCHEDULE'; end if;
  return delivery_private.place_order(p_store_id,p_request,p_idempotency_key,p_access_token);
end;
$$;
revoke all on function public.delivery_place_scheduled_order(uuid,jsonb,uuid,text) from public;
grant execute on function public.delivery_place_scheduled_order(uuid,jsonb,uuid,text) to anon,authenticated,service_role;

-- Quote and final placement must agree: no browser-only Premium restriction.
create or replace function public.delivery_quote_coupon(p_store_id uuid,p_code text,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.delivery_coupons%rowtype; discount numeric;
begin
  if not delivery_private.premium_schedule_enabled(p_store_id) or p_code is null
    or upper(btrim(p_code)) !~ '^[A-Z0-9_-]{3,30}$' or p_subtotal is null or p_subtotal<0 or p_subtotal>100000 then
    return jsonb_build_object('valid',false);
  end if;
  select * into c from public.delivery_coupons where store_id=p_store_id and code=upper(btrim(p_code)) and active;
  if not found or (c.starts_at is not null and c.starts_at>now()) or (c.expires_at is not null and c.expires_at<now())
    or (c.max_uses is not null and c.used_count>=c.max_uses) or p_subtotal<c.min_order then
    return jsonb_build_object('valid',false);
  end if;
  discount:=case when c.discount_type='percent' then round(p_subtotal*c.discount_value/100,2) else c.discount_value end;
  return jsonb_build_object('valid',true,'discount',least(p_subtotal,greatest(0,discount)));
end $$;

-- The server, not the browser clock, authorizes entering preparation.
create or replace function delivery_private.guard_scheduled_preparation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.payload->'scheduledFor') is distinct from (old.payload->'scheduledFor')
    or (new.payload->'preparationMinutes') is distinct from (old.payload->'preparationMinutes')
    or (new.payload->'fulfillmentMode') is distinct from (old.payload->'fulfillmentMode') then
    raise exception 'SCHEDULE_IMMUTABLE';
  end if;
  if new.status not in ('recebido','cancelado') and old.payload ? 'scheduledFor' then
    if now() < (old.payload->>'scheduledFor')::timestamptz - interval '30 minutes' then raise exception 'SCHEDULE_NOT_READY'; end if;
  end if;
  return new;
end;
$$;
revoke all on function delivery_private.guard_scheduled_preparation() from public,anon,authenticated;
create trigger delivery_scheduled_preparation_guard before update of status,payload on public.delivery_orders
for each row execute function delivery_private.guard_scheduled_preparation();

commit;

-- Reversão: revisar dependências; restaurar delivery_private.place_order a partir
-- do snapshot pré-aplicação, remover o trigger e os novos RPCs/helpers. Não
-- apagar pedidos, payloads agendados, clientes, cupons ou histórico existente.
