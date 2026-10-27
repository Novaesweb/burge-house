import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();after(()=>db.close());
for(const file of ['fixtures/plan_usage_base.sql','fixtures/official_order_event.sql'])await db.exec(await readFile(new URL(file,import.meta.url),'utf8'));
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',U='20000000-0000-4000-8000-000000000001',V='20000000-0000-4000-8000-000000000002',staff='20000000-0000-4000-8000-000000000003';
await db.query("insert into managed_sites(id,nx_id,name,status,plan_code) values($1,'NX-A','Teste A','active','NOVAES_PREMIUM'),($2,'NX-B','Teste B','active','NOVAES_BUSINESS')",[A,B]);
await db.query("insert into store_members values($1,$2,'owner',true),($3,$4,'owner',true),($1,$5,'staff',true)",[A,U,B,V,staff]);
async function as(user,fn){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);try{return await fn();}finally{await db.exec('reset role');}}
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const count=async(ref)=>(await one('select count(*)::int n from store_order_usage_events where store_id=$1 and order_ref=$2',[A,ref])).n;
const record=(ref,store=A,event='accepted',timestamp=null)=>one('select novaesweb_record_order_event($1,$2,$3,null,null,null,$4) value',[store,ref,event,timestamp]);
test('real central RPC snapshot: unaccepted/rejected consume zero; repeated acceptance, cancellation and deletion retain exactly one',async()=>{
 const id=(await one('insert into delivery_orders(store_id) values($1) returning id',[A])).id;
 assert.equal(await count(id),0);await as(U,()=>record('rejected',A,'rejected'));assert.equal(await count('rejected'),0);
 await as(U,async()=>{await db.query("update delivery_orders set status='preparando' where id=$1",[id]);assert.equal((await record(id)).value.recorded,true);assert.equal((await record(id)).value.already_counted,true);});
 assert.equal(await count(id),1);
 await as(U,async()=>{await db.query("update delivery_orders set status='cancelado' where id=$1",[id]);await db.query('delete from delivery_orders where id=$1',[id]);});assert.equal(await count(id),1);
});
test('real central RPC snapshot: other store, inactive membership, staff and anonymous denied; direct table writes denied',async()=>{
 for(const user of [V,staff,null])await assert.rejects(as(user,()=>record('denied')),/vínculo ativo/);
 await assert.rejects(as(U,()=>record('foreign',B)),/vínculo ativo/);
 assert.equal((await as(V,()=>one('select count(*)::int n from store_order_usage_events where store_id=$1',[A]))).n,0);
 await assert.rejects(as(U,()=>db.query("insert into store_order_usage_events(store_id,order_ref,accepted_at,competence,source) values($1,'direct',now(),novaesweb_order_competence(now()),'store_rpc')",[A])),/permission/);
 await db.query('update store_members set is_active=false where store_id=$1 and user_id=$2',[A,U]);await assert.rejects(as(U,()=>record('inactive')),/vínculo ativo/);await db.query('update store_members set is_active=true where store_id=$1 and user_id=$2',[A,U]);
});
test('server competence crosses months at Brasília midnight and special now input works without browser date',async()=>{
 for(const [instant,expected] of [['2026-11-01T02:59:59Z','2026-10-01'],['2026-11-01T03:00:00Z','2026-11-01']]){
  const result=await one("select novaesweb_order_competence($1)::text as competence_value",[instant]);assert.equal(result.competence_value,expected);
 }
 const result=await one("select novaesweb_order_competence('now'::timestamptz)::text as competence_value, date_trunc('month',now() at time zone 'America/Sao_Paulo')::date::text expected");assert.equal(result.competence_value,result.expected);
});
test('original acceptance remains authoritative on timestamp replay and expired retry is rejected instead of retimed',async()=>{
 const timestamp=(await one("select (now()-interval '1 hour')::text value")).value;
 await as(U,()=>record('stable',A,'accepted',timestamp));await as(U,()=>record('stable'));
 assert.equal((await one("select accepted_at=$1::timestamptz as same from store_order_usage_events where order_ref='stable'",[timestamp])).same,true);
 const stale=(await one("select (now()-interval '49 hours')::text value")).value;await assert.rejects(as(U,()=>record('expired',A,'accepted',stale)),/Data fora da janela/);assert.equal(await count('expired'),0);
});

