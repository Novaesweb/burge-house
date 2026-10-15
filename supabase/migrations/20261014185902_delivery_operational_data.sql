-- Additive delivery schema. Does not register stores or import customer/order history.
create schema if not exists delivery_private;
revoke all on schema delivery_private from public;
grant usage on schema delivery_private to anon, authenticated, service_role;

create function delivery_private.store_is_public(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.managed_sites where id = target and status = 'active');
$$;
revoke all on function delivery_private.store_is_public(uuid) from public;
grant execute on function delivery_private.store_is_public(uuid) to anon, authenticated, service_role;
-- This definer only exposes the public availability boolean. It never returns private store data.

create function public.delivery_has_role(target uuid, allowed_roles text[]) returns boolean
language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) is not null
    and delivery_private.store_is_public(target)
    and (public.novaesweb_connect_is_active_master() or
      (public.novaesweb_connect_is_active_store_member(target) and exists(
        select 1 from public.store_members m where m.store_id = target
        and m.user_id = (select auth.uid()) and m.is_active and m.role = any(allowed_roles))));
$$;
revoke all on function public.delivery_has_role(uuid,text[]) from public, anon;
grant execute on function public.delivery_has_role(uuid,text[]) to authenticated, service_role;

create table public.delivery_settings (
  store_id uuid primary key references public.managed_sites(id) on delete cascade,
  payload jsonb not null check(jsonb_typeof(payload) = 'object')
    check(payload - array['name','slug','phone','address','openingHours','deliveryFee','isOpen','logoUrl','bannerUrl','primaryColor','acceptedPaymentMethods','pixKey','pixKeyType']::text[] = '{}'::jsonb)
    check(coalesce((payload->>'deliveryFee')::numeric,0) between 0 and 10000),
  updated_at timestamptz not null default now()
);
create table public.delivery_categories (
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  id text not null check(length(id) between 1 and 160),
  payload jsonb not null check(jsonb_typeof(payload)='object' and length(payload->>'name') between 1 and 160),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(store_id,id)
);
create table public.delivery_products (
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  id text not null check(length(id) between 1 and 160),
  category_id text not null,
  price_cents bigint not null check(price_cents between 0 and 100000000),
  is_active boolean not null default true,
  payload jsonb not null check(jsonb_typeof(payload)='object' and length(payload->>'name') between 1 and 200),
  updated_at timestamptz not null default now(),
  primary key(store_id,id),
  foreign key(store_id,category_id) references public.delivery_categories(store_id,id) on delete restrict
);
create index delivery_products_category_idx on public.delivery_products(store_id,category_id);
create table public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  order_number bigint generated always as identity,
  idempotency_key uuid not null,
  access_hash text not null,
  request_hash text not null,
  customer_phone_hash text not null,
  total_cents bigint not null check(total_cents >= 0),
  status text not null default 'recebido' check(status in ('recebido','preparando','itens_separados','esperando_motoboy','saiu_para_entrega','entregue','cancelado')),
  is_paid boolean not null default false,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(store_id,idempotency_key)
);
create index delivery_orders_store_created_idx on public.delivery_orders(store_id,created_at desc);
create index delivery_orders_phone_created_idx on public.delivery_orders(store_id,customer_phone_hash,created_at desc);
create table public.delivery_customers (
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  phone_hash text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(store_id,id), unique(store_id,phone_hash)
);
create table public.delivery_manual_payments (
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  id text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object') check((payload->>'amount')::numeric between 0 and 1000000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(store_id,id)
);

create function delivery_private.prevent_store_transfer() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.store_id is distinct from old.store_id then raise exception 'STORE_TRANSFER_FORBIDDEN' using errcode='42501'; end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function delivery_private.prevent_store_transfer() from public,anon,authenticated;

do $$
declare t text;
begin
  foreach t in array array['delivery_settings','delivery_categories','delivery_products','delivery_orders','delivery_customers','delivery_manual_payments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create trigger prevent_store_transfer before update on public.%I for each row execute function delivery_private.prevent_store_transfer()',t);
  end loop;
end $$;

-- Public catalogue is intentional. Customer data and financial data are never public.
grant select on public.delivery_settings,public.delivery_categories,public.delivery_products to anon,authenticated;
grant insert,update,delete on public.delivery_settings,public.delivery_categories,public.delivery_products to authenticated;
create policy settings_public_read on public.delivery_settings for select to anon using(delivery_private.store_is_public(store_id));
create policy categories_public_read on public.delivery_categories for select to anon using(is_active and delivery_private.store_is_public(store_id));
create policy products_public_read on public.delivery_products for select to anon using(is_active and delivery_private.store_is_public(store_id)
  and exists(select 1 from public.delivery_categories c where c.store_id=delivery_products.store_id and c.id=delivery_products.category_id and c.is_active));
-- Logged-in visitors keep the same public catalogue access; membership grants access to drafts.
create policy settings_authenticated_read on public.delivery_settings for select to authenticated using(delivery_private.store_is_public(store_id));
create policy categories_authenticated_read on public.delivery_categories for select to authenticated using(delivery_private.store_is_public(store_id) and (is_active or public.delivery_has_role(store_id,array['owner','admin','staff','viewer'])));
create policy products_authenticated_read on public.delivery_products for select to authenticated using(delivery_private.store_is_public(store_id) and (public.delivery_has_role(store_id,array['owner','admin','staff','viewer']) or (is_active and exists(select 1 from public.delivery_categories c where c.store_id=delivery_products.store_id and c.id=delivery_products.category_id and c.is_active))));

do $$
declare t text;
begin
  foreach t in array array['delivery_settings','delivery_categories','delivery_products'] loop
    execute format('create policy manage_insert on public.%I for insert to authenticated with check(public.delivery_has_role(store_id,array[''owner'',''admin'']))',t);
    execute format('create policy manage_update on public.%I for update to authenticated using(public.delivery_has_role(store_id,array[''owner'',''admin''])) with check(public.delivery_has_role(store_id,array[''owner'',''admin'']))',t);
    execute format('create policy manage_delete on public.%I for delete to authenticated using(public.delivery_has_role(store_id,array[''owner'',''admin'']))',t);
  end loop;
end $$;

grant select on public.delivery_orders,public.delivery_customers to authenticated;
grant update(status,is_paid) on public.delivery_orders to authenticated;
create policy orders_read on public.delivery_orders for select to authenticated using(public.delivery_has_role(store_id,array['owner','admin','staff','viewer']));
create policy orders_update on public.delivery_orders for update to authenticated using(public.delivery_has_role(store_id,array['owner','admin','staff'])) with check(public.delivery_has_role(store_id,array['owner','admin','staff']));
create policy customers_read on public.delivery_customers for select to authenticated using(public.delivery_has_role(store_id,array['owner','admin','staff','viewer']));
grant select,insert,update,delete on public.delivery_manual_payments to authenticated;
create policy finance_read on public.delivery_manual_payments for select to authenticated using(public.delivery_has_role(store_id,array['owner','admin']));
create policy finance_insert on public.delivery_manual_payments for insert to authenticated with check(public.delivery_has_role(store_id,array['owner','admin']));
create policy finance_update on public.delivery_manual_payments for update to authenticated using(public.delivery_has_role(store_id,array['owner','admin'])) with check(public.delivery_has_role(store_id,array['owner','admin']));
create policy finance_delete on public.delivery_manual_payments for delete to authenticated using(public.delivery_has_role(store_id,array['owner','admin']));

create function public.delivery_import_catalog(p_store_id uuid,p_settings jsonb,p_categories jsonb,p_products jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare item jsonb;
begin
  if not public.delivery_has_role(p_store_id,array['owner','admin']) then raise exception 'ACTIVE_STORE_OWNER_REQUIRED' using errcode='42501'; end if;
  if jsonb_array_length(p_categories)>200 or jsonb_array_length(p_products)>2000 then raise exception 'CATALOG_TOO_LARGE'; end if;
  insert into public.delivery_settings(store_id,payload) values(p_store_id,p_settings) on conflict do nothing;
  for item in select value from jsonb_array_elements(p_categories) loop
    insert into public.delivery_categories(store_id,id,payload,is_active) values(p_store_id,item->>'id',item-'siteId',coalesce((item->>'isActive')::boolean,true)) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements(p_products) loop
    insert into public.delivery_products(store_id,id,category_id,price_cents,is_active,payload)
    values(p_store_id,item->>'id',item->>'categoryId',round((item->>'price')::numeric*100),coalesce((item->>'isActive')::boolean,true),item-'siteId'-'price') on conflict do nothing;
  end loop;
end;
$$;
revoke all on function public.delivery_import_catalog(uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.delivery_import_catalog(uuid,jsonb,jsonb,jsonb) to authenticated;

create function delivery_private.order_json(o public.delivery_orders) returns jsonb
language sql immutable security invoker set search_path='' as $$
  select o.payload || jsonb_build_object('id',o.id,'siteId',o.store_id,'orderNumber',o.order_number,'total',o.total_cents/100.0,'status',o.status,'isPaid',o.is_paid,'paymentStatus',case when o.is_paid then 'paid' else 'pending' end,'createdAt',o.created_at,'updatedAt',o.updated_at);
$$;
revoke all on function delivery_private.order_json(public.delivery_orders) from public,anon,authenticated;

-- The following private definers are narrow guest checkout APIs, not membership bypasses.
-- Guests have no table write/read privileges. Only validated order creation and secret-scoped tracking are exposed.
create function delivery_private.place_order(p_store_id uuid,p_request jsonb,p_idempotency_key uuid,p_access_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  cfg jsonb; line jsonb; product public.delivery_products; addon jsonb; chosen jsonb; removal jsonb;
  unit_cents bigint; subtotal bigint:=0; fee bigint; qty integer; total_qty integer:=0;
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
  if cfg is null or coalesce((cfg->>'isOpen')::boolean,false)=false then raise exception 'STORE_CLOSED'; end if;
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
  safe_request:=jsonb_strip_nulls(jsonb_build_object('customerName',btrim(p_request->>'customerName'),'customerPhone',phone,'deliveryAddress',p_request->'deliveryAddress','paymentMethod',p_request->>'paymentMethod','paymentChange',left(p_request->>'paymentChange',30),'notes',p_request->>'notes','items',cooked,'subtotal',subtotal/100.0,'deliveryFee',fee/100.0,'estimatedMinutes',40));
  insert into public.delivery_orders(store_id,idempotency_key,access_hash,request_hash,customer_phone_hash,total_cents,payload)
    values(p_store_id,p_idempotency_key,token_hash,input_hash,v_phone_hash,subtotal+fee,safe_request) returning * into o;
  customer:=jsonb_build_object('name',p_request->>'customerName','phone',phone,'address',(p_request->'deliveryAddress'->>'street')||', '||(p_request->'deliveryAddress'->>'number'),'totalOrders',1,'totalSpent',(subtotal+fee)/100.0,'lastOrderAt',o.created_at);
  insert into public.delivery_customers(store_id,phone_hash,payload) values(p_store_id,v_phone_hash,customer)
    on conflict(store_id,phone_hash) do update set payload=excluded.payload||jsonb_build_object('totalOrders',coalesce((delivery_customers.payload->>'totalOrders')::integer,0)+1,'totalSpent',coalesce((delivery_customers.payload->>'totalSpent')::numeric,0)+(subtotal+fee)/100.0);
  return delivery_private.order_json(o);
end;
$$;
create function public.delivery_place_order(p_store_id uuid,p_request jsonb,p_idempotency_key uuid,p_access_token text) returns jsonb
language sql security invoker set search_path='' as $$select delivery_private.place_order(p_store_id,p_request,p_idempotency_key,p_access_token);$$;

create function delivery_private.track_order(p_store_id uuid,p_order_id uuid,p_access_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.delivery_orders;
begin
  if p_access_token is null or p_access_token !~ '^[0-9a-f]{64}$' then raise exception 'ORDER_NOT_FOUND' using errcode='42501'; end if;
  select * into o from public.delivery_orders where store_id=p_store_id and id=p_order_id and access_hash=encode(sha256(convert_to(p_access_token,'UTF8')),'hex');
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='42501'; end if;
  return delivery_private.order_json(o);
end;
$$;
create function public.delivery_track_order(p_store_id uuid,p_order_id uuid,p_access_token text) returns jsonb
language sql security invoker set search_path='' as $$select delivery_private.track_order(p_store_id,p_order_id,p_access_token);$$;

create function delivery_private.review_order(p_store_id uuid,p_order_id uuid,p_access_token text,p_review jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_access_token is null or p_access_token !~ '^[0-9a-f]{64}$' then raise exception 'ORDER_NOT_FOUND' using errcode='42501'; end if;
  if p_review is null or (p_review->>'foodRating')::integer not between 1 and 5 or (p_review->>'deliveryRating')::integer not between 1 and 5
    or p_review->>'foodRating' is null or p_review->>'deliveryRating' is null or coalesce(length(p_review->>'comment'),0)>1000 then raise exception 'INVALID_REVIEW'; end if;
  update public.delivery_orders set payload=jsonb_set(payload,'{review}',jsonb_build_object('foodRating',(p_review->>'foodRating')::integer,'deliveryRating',(p_review->>'deliveryRating')::integer,'comment',left(p_review->>'comment',1000),'createdAt',now()))
    where store_id=p_store_id and id=p_order_id and status='entregue' and not(payload ? 'review') and access_hash=encode(sha256(convert_to(p_access_token,'UTF8')),'hex');
  if not found then raise exception 'REVIEW_UNAVAILABLE' using errcode='42501'; end if;
end;
$$;
create function public.delivery_review_order(p_store_id uuid,p_order_id uuid,p_access_token text,p_review jsonb) returns void
language sql security invoker set search_path='' as $$select delivery_private.review_order(p_store_id,p_order_id,p_access_token,p_review);$$;

revoke all on function delivery_private.place_order(uuid,jsonb,uuid,text),public.delivery_place_order(uuid,jsonb,uuid,text),
  delivery_private.track_order(uuid,uuid,text),public.delivery_track_order(uuid,uuid,text),
  delivery_private.review_order(uuid,uuid,text,jsonb),public.delivery_review_order(uuid,uuid,text,jsonb) from public;
grant execute on function delivery_private.place_order(uuid,jsonb,uuid,text),public.delivery_place_order(uuid,jsonb,uuid,text),
  delivery_private.track_order(uuid,uuid,text),public.delivery_track_order(uuid,uuid,text),
  delivery_private.review_order(uuid,uuid,text,jsonb),public.delivery_review_order(uuid,uuid,text,jsonb) to anon,authenticated;

-- Realtime has private row policies; no guest orders are streamed.
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['delivery_settings','delivery_categories','delivery_products','delivery_orders','delivery_customers','delivery_manual_payments'] loop
      execute format('alter publication supabase_realtime add table public.%I',t);
    end loop;
  end if;
end $$;

