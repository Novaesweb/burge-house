import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
after(async () => { await db.close(); });
const sql = async file => readFile(new URL(file, import.meta.url), 'utf8');
await db.exec(await sql('fixtures/plan_usage_base.sql'));
await db.exec(await sql('../supabase/proposals/20261025185555_store_plan_usage_and_reporting.sql'));
const A='10000000-0000-4000-8000-000000000001', B='10000000-0000-4000-8000-000000000002';
const ownerA='20000000-0000-4000-8000-000000000001', ownerB='20000000-0000-4000-8000-000000000002', staff='20000000-0000-4000-8000-000000000003';
const one = async (query,args=[]) => (await db.query(query,args)).rows[0];
const insert = async (store=A) => (await one('insert into delivery_orders(store_id) values($1) returning id',[store])).id;
const update = (id,status) => db.query('update delivery_orders set status=$2 where id=$1',[id,status]);
const usage = async (store=A) => (await one('select delivery_plan_usage($1) as value',[store])).value;
async function asUser(user, operation) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  try { return await operation(); } finally { await db.exec('reset role'); }
}
await db.query("insert into managed_sites(id,nx_id,name,status,plan_code) values($1,'NX-FIXTURE-A','Fixture A','active','NOVAES_PREMIUM'),($2,'NX-FIXTURE-B','Fixture B','active','NOVAES_BUSINESS')",[A,B]);
await db.query("insert into store_members values($1,$2,'owner',true),($3,$4,'owner',true),($1,$5,'staff',true)",[A,ownerA,B,ownerB,staff]);

test('created and rejected orders consume zero, acceptance is unique and remains after cancellation/deletion', async () => {
  const rejected=await insert(); await update(rejected,'cancelado');
  const id=await insert();
  assert.equal((await asUser(ownerA,()=>usage())).accepted_count,0);
  await asUser(staff,()=>update(id,'preparando'));
  await update(id,'preparando'); await update(id,'itens_separados'); await update(id,'preparando');
  assert.equal((await asUser(ownerA,()=>usage())).accepted_count,1);
  await update(id,'cancelado'); await db.query('delete from delivery_orders where id=$1',[id]);
  const summary=await asUser(ownerA,()=>usage());
  assert.equal(summary.accepted_count,1); assert.equal(summary.franchise_orders,750);
  assert.equal(summary.daily.reduce((n,day)=>n+day.accepted_count,0),1);
  assert.equal((await one("select count(*)::int as n from store_order_usage_events where order_ref=$1",[id])).n,1);
  for(const event of ['accepted','cancelled','hidden']) assert.equal((await one('select count(*)::int n from store_order_lifecycle_events where order_ref=$1 and event_type=$2',[id,event])).n,1);
});

test('RLS and RPC deny cross-store, inactive, staff, anonymous and direct event writes', async () => {
  await asUser(ownerA,async()=>{
    await assert.rejects(usage(B),/NOT_AUTHORIZED/);
    await assert.rejects(db.query('select delivery_reconcile_order_reporting($1)',[B]),/NOT_AUTHORIZED/);
    assert.equal((await one('select count(*)::int n from store_order_usage_events where store_id=$1',[B])).n,0);
    await assert.rejects(db.query("insert into store_order_usage_events(store_id,order_ref,accepted_at,competence,source) values($1,'forged',now(),novaesweb_order_competence(now()),'store_rpc')",[A]),/permission/);
    await assert.rejects(db.query('select * from delivery_private.order_reporting_outbox'),/permission/);
  });
  await asUser(staff,()=>assert.rejects(usage(),/NOT_AUTHORIZED/));
  await db.query('update store_members set is_active=false where user_id=$1',[ownerA]);
  await asUser(ownerA,()=>assert.rejects(usage(),/NOT_AUTHORIZED/));
  await db.query('update store_members set is_active=true where user_id=$1',[ownerA]);
  await db.exec('set role anon');
  try { await assert.rejects(usage(),/permission/); } finally { await db.exec('reset role'); }
});

test('START is not integrated and unknown/custom quotas are not guessed', async () => {
  await db.query("update managed_sites set plan_code='NOVAES_START' where id=$1",[B]);
  const id=await insert(B); await update(id,'preparando');
  assert.equal((await one('select count(*)::int n from store_order_usage_events where store_id=$1',[B])).n,0);
  await db.query("update managed_sites set plan_code='NOVAES_EMPRESARIAL' where id=$1",[B]);
  const value=await asUser(ownerB,()=>usage(B));
  assert.equal(value.franchise_orders,null); assert.equal(value.overage_tariff,null);
  await db.query("update managed_sites set plan_code='NOVAES_BUSINESS' where id=$1",[B]);
});

test('maintenance and suspension preserve membership/account reads but deny direct operational writes',async()=>{
  const id=await insert();
  for(const status of ['maintenance','suspended','archived','pending']){
    await db.query('update managed_sites set status=$2 where id=$1',[A,status]);
    await asUser(ownerA,async()=>{
      assert.equal((await one('select count(*)::int n from managed_sites where id=$1',[A])).n,1);
      assert.equal((await db.query("update delivery_orders set status='preparando' where id=$1 returning id",[id])).rows.length,0);
      assert.equal((await usage()).store_id,A);
    });
  }
  await db.query("update managed_sites set status='active' where id=$1",[A]);
});

test('server competence follows Brasília at month boundary and does not depend on browser time', async () => {
  assert.equal((await one("select novaesweb_order_competence('2026-11-01T02:59:59Z')::text value")).value,'2026-10-01');
  assert.equal((await one("select novaesweb_order_competence('2026-11-01T03:00:00Z')::text value")).value,'2026-11-01');
});

test('report failure never reverses accepted order; durable retry is bounded and idempotent', async () => {
  const id=await insert();
  await db.exec("create function public.fixture_reporting_failure() returns trigger language plpgsql as $$begin if new.event_type='accepted' then raise exception 'FIXTURE_REPORT_DOWN';end if;return new;end$$; create trigger fixture_reporting_failure before insert on store_order_lifecycle_events for each row execute function fixture_reporting_failure();");
  await update(id,'preparando');
  assert.equal((await one('select status from delivery_orders where id=$1',[id])).status,'preparando');
  assert.equal((await one("select count(*)::int n from store_order_usage_events where order_ref=$1",[id])).n,0);
  const pending=await one("select attempts,last_error_code from delivery_private.order_reporting_outbox where order_ref=$1 and event_type='accepted'",[id]);
  assert.equal(pending.attempts,1); assert.match(pending.last_error_code,/^[A-Z0-9]{5}$/);
  await db.exec('drop trigger fixture_reporting_failure on store_order_lifecycle_events');
  await db.query('update delivery_private.order_reporting_outbox set next_attempt_at=now() where order_ref=$1',[id]);
  await asUser(ownerA,()=>db.query('select delivery_reconcile_order_reporting($1)',[A]));
  await asUser(ownerA,()=>db.query('select delivery_reconcile_order_reporting($1)',[A]));
  assert.equal((await one('select count(*)::int n from store_order_usage_events where order_ref=$1',[id])).n,1);
  assert.equal((await asUser(ownerA,async()=>(await one('select delivery_order_reporting_health($1) value',[A])).value)).pending_count,0);
  const columns=(await db.query("select column_name from information_schema.columns where table_schema='delivery_private' and table_name='order_reporting_outbox'")).rows.map(row=>row.column_name);
  assert.ok(!columns.some(name=>/phone|customer|total|address|payment|items|payload/.test(name)));
});

test('quota exhaustion never blocks additional orders or acceptance', async () => {
  await db.query("insert into store_order_usage_events(store_id,order_ref,accepted_at,competence,source) select $1,'fixture-'||n,now(),novaesweb_order_competence(now()),'store_rpc' from generate_series(1,341) n",[B]);
  const id=await insert(B); await update(id,'preparando');
  const value=await asUser(ownerB,()=>usage(B)); assert.equal(value.franchise_orders,340); assert.equal(value.accepted_count,342);
});
