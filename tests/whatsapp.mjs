import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { config,deliver,tick,database } from '../backend/whatsapp/worker.mjs';
const store='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
// Synthetic fixture only; no network request is made by these tests.
const number='555194892414';
const token='a'.repeat(64);
const env={WHATSAPP_SEND_ENABLED:'true',WHATSAPP_TEST_ONLY:'true',WHATSAPP_TEST_NUMBER:number,
  WHATSAPP_STORE_ID:store,EVOLUTION_URL:'http://127.0.0.1:8080',EVOLUTION_INSTANCE:'fixture',
  EVOLUTION_API_KEY:'fixture-key',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'fixture',WHATSAPP_WORKER_TOKEN:token};
const cfg=config(env);
const event={id:1,store_id:store,phone:number,order_number:42,status:'preparando'};
test('disabled by default and customer sends require explicit approval',()=>{
  assert.throws(()=>config({}));
  assert.throws(()=>config({...env,WHATSAPP_TEST_ONLY:'false'}));
  assert.throws(()=>config({...env,EVOLUTION_URL:'http://example.com'}));
});
test('approved customer mode accepts customer number while preserving store isolation',async()=>{
  const customerCfg=config({...env,WHATSAPP_TEST_ONLY:'false',WHATSAPP_CUSTOMER_SEND_APPROVED:'true'});
  const customerEvent={...event,phone:'11912345678'};
  let calls=0;
  const request=async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).number,'5511912345678');return {ok:true,json:async()=>({key:{id:'mock'}})};};
  assert.equal((await deliver(customerEvent,customerCfg,request)).state,'sent');
  assert.equal((await deliver({...customerEvent,store_id:other},customerCfg,request)).state,'blocked');
  assert.equal(calls,1);
});
test('database transport uses scoped RPC without service-role credentials',async()=>{
  const db=database(env,async(url,options)=>{
    assert.equal(url,'https://fixture.supabase.co/rest/v1/rpc/delivery_claim_whatsapp');
    assert.equal(options.headers.apikey,'fixture');
    assert.equal(JSON.parse(options.body).p_token,token);
    return {ok:true,status:200,json:async()=>[]};
  });
  assert.deepEqual(await db.rpc('delivery_claim_whatsapp',{p_store_id:store,p_token:token}),{data:[]});
  assert.deepEqual(await database(env,async()=>({ok:false})).rpc('delivery_claim_whatsapp',{}),{error:true});
});
test('allowlist and store isolation block before HTTP',async()=>{
  const noNetwork=()=>{throw new Error('MUST NOT CALL');};
  for(const e of [{...event,phone:'5511000000000'},{...event,phone:''},{...event,store_id:other},{...event,status:'unknown'}])
    assert.equal((await deliver(e,cfg,noNetwork)).state,'blocked');
});
test('Evolution contract, normalized number, secret only in server header',async()=>{
  let calls=0;
  const result=await deliver({...event,phone:'5194892414'},cfg,async(url,options)=>{
    calls++;assert.equal(url,'http://127.0.0.1:8080/message/sendText/fixture');
    assert.equal(options.headers.apikey,'fixture-key');assert.equal(options.redirect,'error');
    assert.deepEqual(JSON.parse(options.body),{number,text:'Burge House: seu pedido #42 está em preparo.',linkPreview:false});
    return {ok:true,json:async()=>({key:{id:'mock-id'}})};
  });
  assert.equal(calls,1);assert.equal(result.state,'sent');
});
test('timeouts, provider failures and malformed acceptance require review, no retry',async()=>{
  for(const request of [async()=>{throw new Error('timeout');},async()=>({ok:false,status:503}),async()=>({ok:true,json:async()=>({})})]) {
    let calls=0;assert.equal((await deliver(event,cfg,async(...args)=>{calls++;return request(...args);})).state,'uncertain');
    assert.equal(calls,1);
  }
});
test('claim and acknowledgement failures stop worker',async()=>{
  await assert.rejects(()=>tick({rpc:async()=>({error:true})},cfg),/CLAIM_FAILED/);
  let calls=0;
  await assert.rejects(()=>tick({rpc:async()=>++calls===1?{data:[event]}:{error:true}},cfg,async()=>({ok:true,json:async()=>({key:{id:'mock'}})})),/ACK_FAILED/);
});
test('transactional queue, permissions, ordering and repeated status transitions',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema delivery_private; grant usage on schema public,delivery_private to service_role;
      create table public.managed_sites(id uuid primary key);
      create table public.delivery_orders(id uuid primary key,store_id uuid,order_number bigint,status text,payload jsonb,is_paid boolean);
      insert into public.managed_sites values('${store}'),('${other}');
      insert into public.delivery_orders values('${store}','${store}',42,'recebido','{"customerPhone":"${number}"}',false);`);
    await db.exec(await readFile(new URL('../backend/whatsapp/setup.sql',import.meta.url),'utf8'));
    const count=async()=>Number((await db.query('select count(*) as n from delivery_private.whatsapp_outbox')).rows[0].n);
    await db.exec("update delivery_orders set status='preparando'");assert.equal(await count(),0);
    await db.query('insert into delivery_private.whatsapp_stores values($1,true,$2)',[store,createHash('sha256').update(token).digest('hex')]);
    await db.exec("update delivery_orders set status='preparando',is_paid=true");assert.equal(await count(),0);
    await db.exec("begin; update delivery_orders set status='entregue'; rollback;");assert.equal(await count(),0);
    await db.exec("update delivery_orders set status='saiu_para_entrega'; update delivery_orders set status='preparando'");assert.equal(await count(),2);
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(()=>db.query('select * from public.delivery_claim_whatsapp($1,$2)',[store,'wrong']));
      await assert.rejects(()=>db.query('select * from delivery_private.whatsapp_outbox'));
      await db.exec('reset role');
    }
    await db.exec('set role anon');
    const claim=async(id=store)=>(await db.query('select * from delivery_claim_whatsapp($1,$2)',[id,token])).rows;
    await assert.rejects(()=>claim(other));
    const first=(await claim())[0];assert.equal(first.status,'saiu_para_entrega');assert.equal((await claim()).length,0);
    await assert.rejects(()=>db.query("select delivery_finish_whatsapp($1,$2,$3,'sent','ACCEPTED')",[other,token,first.id]));
    await db.query("select delivery_finish_whatsapp($1,$2,$3,'uncertain','TIMEOUT')",[store,token,first.id]);assert.equal((await claim()).length,0);
    await db.exec('reset role');
    await db.query("update delivery_private.whatsapp_outbox set state='sent' where id=$1",[first.id]);
    await db.exec('set role anon');
    const second=(await claim())[0];assert.equal(second.status,'preparando');
    await db.query("select delivery_finish_whatsapp($1,$2,$3,'sent','ACCEPTED')",[store,token,second.id]);
    await assert.rejects(()=>db.query("select delivery_finish_whatsapp($1,$2,$3,'sent','ACCEPTED')",[store,token,second.id]));
    assert.equal((await claim()).length,0);
  } finally {await db.close();}
});
