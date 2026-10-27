import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
const db = new PGlite();
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const one=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema delivery_private;
create table managed_sites(id uuid primary key,status text,plan_code text);
create table delivery_settings(store_id uuid primary key,payload jsonb);
create table delivery_categories(store_id uuid,id text,is_active boolean);
create table delivery_products(store_id uuid,id text,category_id text,price_cents bigint,is_active boolean,payload jsonb);
create table delivery_coupons(store_id uuid,code text,active boolean,starts_at timestamptz,expires_at timestamptz,max_uses integer,used_count integer, min_order numeric, discount_type text,discount_value numeric);
create table delivery_orders(id uuid default gen_random_uuid() primary key,store_id uuid,order_number bigint generated always as identity,idempotency_key uuid,access_hash text,request_hash text,customer_phone_hash text,total_cents bigint,payload jsonb,status text default 'recebido',is_paid boolean default false,created_at timestamptz default now(),updated_at timestamptz default now(),unique(store_id,idempotency_key));
create table delivery_customers(store_id uuid,phone_hash text,payload jsonb,unique(store_id,phone_hash));
create function public.delivery_has_role(target uuid,roles text[]) returns boolean language sql as $$select false$$;
create function delivery_private.store_is_public(target uuid) returns boolean language sql as $$select exists(select 1 from public.managed_sites where id=target and status='active')$$;
create function delivery_private.schedule_is_open(cfg jsonb) returns boolean language sql as $$select coalesce((cfg->>'isOpen')::boolean,false)$$;
grant usage on schema delivery_private,public to anon,authenticated,service_role;
`);
await db.exec(await readFile(new URL('fixtures/delivery_current_functions.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/proposals/20261025185604_premium_scheduled_orders.sql',import.meta.url),'utf8'));
await db.exec(`grant execute on function delivery_private.place_order(uuid,jsonb,uuid,text) to anon,authenticated; alter table delivery_orders enable row level security; grant select,update(status,payload) on delivery_orders to authenticated; create policy fixture_scope on delivery_orders to authenticated using(store_id=nullif(current_setting('fixture.store',true),'')::uuid) with check(store_id=nullif(current_setting('fixture.store',true),'')::uuid);`);
const weekly=Object.fromEntries(Array.from({length:7},(_,day)=>[day,{enabled:true,open:'00:00',close:'00:00'}]));
for (const store of [A,B]) {
  await db.query("insert into managed_sites values($1,'active','NOVAES_PREMIUM')",[store]);
  await db.query('insert into delivery_settings values($1,$2)',[store,{isOpen:true,autoHoursEnabled:true,weeklySchedule:weekly,deliveryFee:5,acceptedPaymentMethods:['cash']}]);
  await db.query("insert into delivery_categories values($1,'category',true)",[store]);
  await db.query("insert into delivery_products values($1,'product','category',2000,true,'{\"name\":\"Produto fictício\"}')",[store]);
}
const options=async(store=A)=>(await one('select delivery_schedule_options($1) result',[store])).result;
const request={customerName:'Cliente fictício',customerPhone:'51900000000',deliveryAddress:{street:'Rua de teste',number:'1',neighborhood:'Centro'},paymentMethod:'cash',items:[{productId:'product',quantity:1}]};
const place=async(extra={},store=A,key=crypto.randomUUID())=>(await one('select delivery_place_scheduled_order($1,$2,$3,$4) result',[store,{...request,scheduledFor:(await options(store)).slots?.[4],...extra},key,'a'.repeat(64)])).result;
test('SQL scheduling returns server slots and refuses non Premium, suspended and unknown stores',async()=>{
  const data=await options(); assert.equal(data.enabled,true); assert.ok(data.slots.length>0); assert.equal(data.preparation_minutes,30);
  await db.query("update managed_sites set plan_code='BASIC' where id=$1",[B]); assert.equal((await options(B)).enabled,false);
  await assert.rejects(place({scheduledFor:data.slots[4]},B),/SCHEDULING_UNAVAILABLE/);
  await db.query("update managed_sites set status='suspended' where id=$1",[B]); assert.equal((await options(B)).enabled,false);
  assert.equal((await options(crypto.randomUUID())).enabled,false);
});
test('same core preserves repricing, idempotency and isolation while pickup charges no delivery fee',async()=>{
  const slot=(await options()).slots[4], key=crypto.randomUUID();
  const result=await place({scheduledFor:slot,fulfillmentMode:'pickup',total:1,deliveryFee:999},A,key);
  assert.equal(result.total,20);assert.equal(result.deliveryFee,0);assert.equal(result.preparationMinutes,30);assert.equal(result.fulfillmentMode,'pickup');
  assert.deepEqual(await place({scheduledFor:slot,fulfillmentMode:'pickup',total:1,deliveryFee:999},A,key),result);
  await assert.rejects(place({scheduledFor:slot,fulfillmentMode:'delivery'},A,key),/IDEMPOTENCY_CONFLICT/);
  assert.equal((await one('select count(*)::int n from delivery_orders where store_id=$1',[A])).n,1);
  assert.equal((await one('select count(*)::int n from delivery_orders where store_id=$1',[B])).n,0);
  assert.equal((await one('select payload from delivery_customers where store_id=$1',[A])).payload.totalSpent,20);
});
test('server refuses near, past, malformed, outside weekly hours and paused schedules',async()=>{
  for (const value of [new Date().toISOString(),'invalid','2020-01-01T00:00:00Z','infinity']) await assert.rejects(place({scheduledFor:value}),/SCHEDULE/);
  const slot=(await options()).slots[5];
  await db.query("update delivery_settings set payload=jsonb_set(payload,'{isOpen}','false') where store_id=$1",[A]);
  await assert.rejects(place({scheduledFor:slot}),/SCHEDULE/);
  await db.query("update delivery_settings set payload=jsonb_set(payload,'{isOpen}','true') where store_id=$1",[A]);
  const cfg={isOpen:true,autoHoursEnabled:true,weeklySchedule:{0:{enabled:true,open:'22:00',close:'02:00'}}};
  assert.equal((await one('select delivery_private.schedule_open_at($1,$2) open',[cfg,'2026-10-26T01:00:00-03:00'])).open,true);
  assert.equal((await one('select delivery_private.schedule_open_at($1,$2) open',[cfg,'2026-10-26T02:00:00-03:00'])).open,false);
});
test('server prevents early acceptance independently of browser clock and permits cancellation; other store cannot read/update',async()=>{
  const result=(await one('select id from delivery_orders where store_id=$1',[A]));
  await db.exec(`set role authenticated;select set_config('fixture.store','${B}',false);`);
  assert.equal((await one('select count(*)::int n from delivery_orders')).n,0);
  assert.equal((await db.query("update delivery_orders set status='preparando' where id=$1 returning id",[result.id])).rows.length,0);
  await db.exec(`select set_config('fixture.store','${A}',false);`);
  await assert.rejects(db.query("update delivery_orders set status='preparando' where id=$1",[result.id]),/SCHEDULE_NOT_READY/);
  await assert.rejects(db.query("update delivery_orders set payload=jsonb_set(payload,'{scheduledFor}',to_jsonb(now()-interval '1 day')) where id=$1",[result.id]),/SCHEDULE_IMMUTABLE/);
  await db.query("update delivery_orders set status='cancelado' where id=$1",[result.id]);
  assert.equal((await one('select status from delivery_orders where id=$1',[result.id])).status,'cancelado');
  await assert.rejects(db.query("update delivery_orders set status='preparando' where id=$1",[result.id]),/SCHEDULE_NOT_READY/);
  await db.exec('reset role');
});

test('Premium coupon validation and final checkout agree on start, usage limit and discount excluding delivery',async()=>{
  const slot=(await options()).slots[5];
  await db.query("insert into delivery_coupons(store_id,code,active,starts_at,max_uses,used_count,min_order,discount_type,discount_value) values($1,'FIXTURE',true,now()+interval '1 day',1,0,0,'fixed',100)",[A]);
  const quote=async(store=A)=>(await one("select delivery_quote_coupon($1,'FIXTURE',20) result",[store])).result;
  assert.equal((await quote()).valid,false);
  await assert.rejects(place({scheduledFor:slot,couponCode:'FIXTURE'}),/COUPON_UNAVAILABLE/);
  await db.query("update delivery_coupons set starts_at=now()-interval '1 day' where store_id=$1",[A]);
  assert.equal((await quote()).discount,20);
  const discounted=await place({scheduledFor:slot,couponCode:'FIXTURE',fulfillmentMode:'delivery'});
  assert.equal(discounted.total,5);assert.equal(discounted.discount,20);assert.equal(discounted.deliveryFee,5);
  assert.equal((await quote()).valid,false);
  await assert.rejects(place({scheduledFor:slot,couponCode:'FIXTURE'}),/COUPON_UNAVAILABLE/);
  await db.query("update managed_sites set status='active',plan_code='NOVAES_BUSINESS' where id=$1",[B]);
  assert.equal((await one('select delivery_premium_features($1) result',[B])).result.coupons,false);
  assert.equal((await quote(B)).valid,false);
});
after(async()=>{await db.close();});
