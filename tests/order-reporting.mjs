import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const code=transformSync(readFileSync(new URL('../src/services/orderReportingService.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
const store='10000000-0000-4000-8000-000000000001',user='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002',order='30000000-0000-4000-8000-000000000001';
function setup({role='owner',plan='NOVAES_PREMIUM',auth=user,storageFailure=false,storageRef}={}){
 const module={exports:{}},storage=storageRef||new Map(),calls=[],events=[],state={now:Date.parse('2026-10-27T12:00:00Z'),failure:null};
 class Clock extends Date{static now(){return state.now;}}
 const client={auth:{getUser:async()=>({data:{user:auth?{id:auth}:null},error:null}),getSession:async()=>({data:{session:{user:{id:auth}}},error:null})},from(table){const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:table==='store_members'?{role}:{plan_code:plan},error:null})};return q;},rpc:async(name,args)=>{calls.push({name,args});return state.failure?{data:null,error:state.failure}:{data:{recorded:false,already_counted:true,event_type:'accepted',competence:'2026-10'},error:null};}};
 vm.runInNewContext(code,{module,exports:module.exports,Date:Clock,localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(storageFailure)throw new Error('blocked');storage.set(k,v);}},window:{dispatchEvent:e=>events.push(e)},Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},require(name){assert.equal(name,'../lib/supabase');return{requireSupabase:()=>client};}});
 return{api:module.exports,storage,calls,state,events};
}
test('confirmed acceptance persists only stable technical fields; idempotent replay succeeds even recorded=false',async()=>{
 const {api,calls,storage}=setup();const instant='2026-10-27T11:58:00Z';
 api.queueAcceptedOrder(store,user,'NOVAES_PREMIUM',order,instant);api.queueAcceptedOrder(store,user,'NOVAES_PREMIUM',order,'2026-10-27T11:59:00Z');
 assert.equal(api.localReportingHealth(store,user).pending_count,1);
 await api.flushAcceptedOrders(store,user);assert.equal(calls.length,1);assert.equal(calls[0].name,'novaesweb_record_order_event');
 assert.deepEqual(Object.keys(calls[0].args).sort(),['p_event_type','p_occurred_at','p_order_ref','p_store_id']);assert.equal(calls[0].args.p_occurred_at,instant);
 assert.equal(api.localReportingHealth(store,user).pending_count,0);assert.ok([...storage.values()].every(value=>!value.includes('customer')));
});
test('retry preserves original timestamp, backs off, survives reload and stops after eight attempts',async()=>{
 const {api,calls,state,storage}=setup();api.queueAcceptedOrder(store,user,'NOVAES_BUSINESS',order,'2026-10-27T11:58:00Z');state.failure={code:'NETWORK'};
 await api.flushAcceptedOrders(store,user);await api.flushAcceptedOrders(store,user);assert.equal(calls.length,1);
 for(let i=1;i<8;i++){state.now+=900_001;await api.flushAcceptedOrders(store,user);}
 assert.equal(calls.length,8);assert.equal(api.localReportingHealth(store,user).review_count,1);state.now+=900_001;await api.flushAcceptedOrders(store,user);assert.equal(calls.length,8);
 assert.ok([...storage.values()][0].includes('2026-10-27T11:58:00Z'));
});
test('Start, unauthenticated, wrong account, staff and other-store queues never send acceptance',async()=>{
 for(const options of [{plan:'NOVAES_START'},{auth:null},{auth:other},{role:'staff'}]){
  const {api,calls}=setup(options);api.queueAcceptedOrder(store,user,'NOVAES_PREMIUM',order,'2026-10-27T11:58:00Z');await api.flushAcceptedOrders(store,user);assert.equal(calls.length,0);
 }
 const {api,calls}=setup();api.queueAcceptedOrder(store,user,'NOVAES_START',order,'2026-10-27T11:58:00Z');await api.flushAcceptedOrders(store,user);assert.equal(calls.length,0);
 api.queueAcceptedOrder(store,user,'NOVAES_PREMIUM',order,'2026-10-27T11:58:00Z');await api.flushAcceptedOrders('10000000-0000-4000-8000-000000000002',user);assert.equal(calls.length,0);
});
test('backend authorization/date refusal stays pending for review; storage failure never throws into the order flow',async()=>{
 const {api,calls,state}=setup();api.queueAcceptedOrder(store,user,'NOVAES_PREMIUM',order,'2026-10-24T11:58:00Z');state.failure={code:'22023'};await api.flushAcceptedOrders(store,user);assert.equal(api.localReportingHealth(store,user).review_count,1);await api.flushAcceptedOrders(store,user);assert.equal(calls.length,1);
 const blocked=setup({storageFailure:true});assert.doesNotThrow(()=>blocked.api.queueAcceptedOrder(store,user,'NOVAES_PREMIUM',order,'2026-10-27T11:58:00Z'));assert.equal(blocked.events[0].type,'delivery-data-error');
});
test('a new page instance resumes the stored acceptance without changing its timestamp',async()=>{
 const initial=setup();initial.api.queueAcceptedOrder(store,user,'NOVAES_PREMIUM',order,'2026-10-27T11:58:00Z');initial.state.failure={code:'NETWORK'};await initial.api.flushAcceptedOrders(store,user);
 const reload=setup({storageRef:initial.storage});reload.state.now+=60_001;await reload.api.flushAcceptedOrders(store,user);
 assert.equal(reload.calls.length,1);assert.equal(reload.calls[0].args.p_occurred_at,'2026-10-27T11:58:00Z');assert.equal(reload.api.localReportingHealth(store,user).pending_count,0);
});

const remoteCode=transformSync(readFileSync(new URL('../src/services/remoteStoreService.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
function remote({conflict=false,error=null}={}){
 const module={exports:{}},queued=[];
 const client={auth:{getSession:async()=>({data:{session:{user:{id:user}}},error:null})},from(table){assert.equal(table,'delivery_orders');const q={update(){return q;},eq(){return q;},select(){return q;},maybeSingle:async()=>({data:conflict?null:{id:order,updated_at:'2026-10-27T11:58:00Z'},error})};return q;}};
 vm.runInNewContext(remoteCode,{module,exports:module.exports,window:{dispatchEvent(){}},Event:class{},require(name){if(name==='../lib/supabase')return{requireSupabase:()=>client};if(name==='./orderReportingService')return{queueAcceptedOrder:(...args)=>queued.push(args),flushAcceptedOrders:async()=>{}};if(name==='./storeDefaults'||name==='../lib/localStore'||name==='../utils/checkout')return{};throw new Error(name);}});
 const api=module.exports;api.setConnectedStore({id:store,role:'owner',status:'active',plan_code:'NOVAES_PREMIUM'});return{api,queued};
}
test('real update call site reports only confirmed received-to-preparing transition, never conflict, payment or other stages',async()=>{
 const confirmed=remote();await confirmed.api.updateRemoteOrder(store,order,{status:'preparando'},'recebido');assert.equal(confirmed.queued.length,1);assert.equal(confirmed.queued[0][4],'2026-10-27T11:58:00Z');
 for(const [changes,expected] of [[{is_paid:true},undefined],[{status:'cancelado'},'recebido'],[{status:'preparando'},'itens_separados'],[{status:'entregue'},'saiu_para_entrega']]){const test=remote();await test.api.updateRemoteOrder(store,order,changes,expected);assert.equal(test.queued.length,0);}
 for(const options of [{conflict:true},{error:{message:'permission denied'}}]){const test=remote(options);await assert.rejects(test.api.updateRemoteOrder(store,order,{status:'preparando'},'recebido'));assert.equal(test.queued.length,0);}
});
