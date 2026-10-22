import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instanceName, normalizePhone, loadStoreContact, verifyStoreSender } from '../backend/whatsapp/storeConnection.mjs';
import { config, tick, safeErrorCode } from '../backend/whatsapp/worker.mjs';

const store='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
const number='555194892414';
const env={WHATSAPP_SEND_ENABLED:'true',WHATSAPP_TEST_ONLY:'true',WHATSAPP_TEST_NUMBER:number,
  WHATSAPP_STORE_ID:store,WHATSAPP_INSTANCE_MODE:'store',EVOLUTION_URL:'http://127.0.0.1:8080',
  EVOLUTION_API_KEY:'fixture-key',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'fixture',WHATSAPP_WORKER_TOKEN:'a'.repeat(64)};
const cfg=config(env);
const event={id:1,store_id:store,phone:number,order_number:42,status:'preparando',state:'sending'};
function provider({contact=number,owner=number,state='open',name=instanceName(store)}={}) {
  return async(url,options)=>{
    assert.equal(options.redirect,'error');
    if(url.includes('/delivery_settings?')) return {ok:true,json:async()=>[{payload:{phone:contact,name:'Fixture Store'}}]};
    assert.equal(url,`${cfg.url}/instance/fetchInstances?instanceName=${instanceName(store)}`);
    return {ok:true,json:async()=>[{name,connectionStatus:state,ownerJid:owner+'@s.whatsapp.net',token:'never-return-this'}]};
  };
}
test('dedicated names use only validated official UUIDs; phones normalized',()=>{
  assert.equal(instanceName(store),'nw_10000000000040008000000000000001');
  assert.notEqual(instanceName(store),instanceName(other));
  assert.throws(()=>instanceName('NX-4500lko'));
  assert.throws(()=>instanceName('../fixture'));
  assert.equal(normalizePhone('(51) 9489-2414'),number);
  assert.equal(cfg.instance,instanceName(store));
  assert.throws(()=>config({...env,WHATSAPP_INSTANCE_MODE:'other'}));
});
test('contact lookup scoped to store; credentials in header only; inaccessible rows fail closed',async()=>{
  const result=await loadStoreContact(env,store,async(url,options)=>{
    assert.equal(url,`${env.SUPABASE_URL}/rest/v1/delivery_settings?select=payload&store_id=eq.${store}`);
    assert.deepEqual(options.headers,{apikey:'fixture'});
    return {ok:true,json:async()=>[{payload:{phone:number,name:'Fixture Store'}}]};
  });
  assert.deepEqual(result,{phone:number,name:'Fixture Store'});
  for(const rows of [[],[{},{}],[{payload:{phone:'invalid',name:'Fixture'}}],[{payload:{phone:number,name:'Bad\nName'}}]]) {
    await assert.rejects(()=>loadStoreContact(env,store,async()=>({ok:true,json:async()=>rows})),/STORE_CONTACT_UNAVAILABLE/);
  }
});
test('sender requires dedicated instance, connected state and exact current phone',async()=>{
  const result=await verifyStoreSender(env,cfg,provider());
  assert.equal(result.storeName,'Fixture Store');
  assert.equal(result.senderPhone,number);
  assert.equal((await verifyStoreSender(env,cfg,provider({owner:number+':12'}))).senderPhone,number);
  assert.equal(JSON.stringify(result).includes('never-return-this'),false);
  for(const options of [{name:instanceName(other)},{owner:'5511912345678'},{state:'close'}]) {
    await assert.rejects(()=>verifyStoreSender(env,cfg,provider(options)),/SENDER_BINDING_MISMATCH|SENDER_NOT_CONNECTED/);
  }
});
test('sender refresh observes three phone changes with no stale cache',async()=>{
  for(const phone of ['5511912345678','5521912345678','5531912345678']) {
    assert.equal((await verifyStoreSender(env,cfg,provider({contact:phone,owner:phone}))).senderPhone,phone);
    await assert.rejects(()=>verifyStoreSender(env,cfg,provider({contact:phone})),/SENDER_BINDING_MISMATCH/);
  }
});
test('disconnected/mismatched sender leaves pending queue unclaimed',async()=>{
  let claims=0,saves=0;
  const db={rpc:async()=>{claims++;return {data:[]};}};
  const journal={load:async()=>null,save:async()=>{saves++;}};
  await assert.rejects(()=>tick(db,cfg,provider({owner:'5511912345678'}),journal),/SENDER_BINDING_MISMATCH/);
  assert.equal(claims,0);assert.equal(saves,0);
});
test('number changed after claim prevents dispatch and retains claim for recovery',async()=>{
  let saved=null,contacts=0,sends=0,finishes=0;
  const journal={load:async()=>saved,save:async value=>{saved=value;}};
  const db={rpc:async name=>name==='delivery_claim_whatsapp'?{data:[event]}:(finishes++,{data:null})};
  const request=async(url,options)=>{
    if(url.includes('/delivery_settings?')) return {ok:true,json:async()=>[{payload:{phone:++contacts===1?number:'5511912345678',name:'Fixture Store'}}]};
    if(url.includes('/message/sendText/')){sends++;throw new Error('MUST_NOT_SEND');}
    return provider()(url,options);
  };
  await assert.rejects(()=>tick(db,cfg,request,journal),/SENDER_BINDING_MISMATCH/);
  assert.equal(saved.phase,'claim');assert.equal(sends,0);assert.equal(finishes,0);
});
test('store worker dispatches from derived instance with current store name',async()=>{
  let saved=null,sends=0;
  const journal={load:async()=>saved,save:async value=>{saved=value;}};
  const db={rpc:async name=>name==='delivery_claim_whatsapp'?{data:[event]}:{data:null}};
  await tick(db,cfg,async(url,options)=>{
    if(url.includes('/message/sendText/')) {
      sends++;assert.equal(url,`${cfg.url}/message/sendText/${instanceName(store)}`);
      assert.equal(JSON.parse(options.body).text,'Fixture Store: seu pedido #42 está em preparo.');
      return {ok:true,json:async()=>({key:{id:'accepted'}})};
    }
    return provider()(url,options);
  },journal);
  assert.equal(sends,1);assert.equal(saved,null);
});
test('acknowledgement and interrupted dispatch recover while sender offline without HTTP',async()=>{
  for(const initial of [{phase:'finish',result:{state:'sent',code:'ACCEPTED'}},{phase:'dispatching'}]) {
    let saved={id:crypto.randomUUID(),...initial},finish;
    const journal={load:async()=>saved,save:async value=>{saved=value;}};
    const db={rpc:async(name,args)=>name==='delivery_claim_whatsapp'?{data:[event]}:(finish=args,{data:null})};
    await tick(db,cfg,()=>{throw new Error('NO_HTTP_DURING_RECOVERY');},journal);
    assert.equal(finish.p_state,initial.phase==='finish'?'sent':'uncertain');
    assert.equal(saved,null);
  }
});
test('unknown errors never disclose provider or runtime secrets in log codes',()=>{
  assert.equal(safeErrorCode(new Error('secret=never-return-this')),'UNEXPECTED_FAILURE');
  assert.equal(safeErrorCode(new Error('SENDER_NOT_CONNECTED')),'SENDER_NOT_CONNECTED');
});
