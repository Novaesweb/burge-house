import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import vm from 'node:vm';
const id='10000000-0000-4000-8000-000000000001';
const code=transformSync(readFileSync(new URL('../src/services/remoteStoreService.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
function moduleFor(result={data:[{status:'active'}],error:null}){
 const module={exports:{}},events=[],callbacks=new Map(),channels=[],timers=[];
 const client={rpc:async()=>result,from(){throw new Error('UNEXPECTED_DATABASE_READ');},channel(name){channels.push(name);return{on(_event,filter,callback){callbacks.set(filter.table,callback);return this;},subscribe(){return this;}};},removeChannel(){}};
 vm.runInNewContext(code,{module,exports:module.exports,crypto:{randomUUID:()=> 'fixture-channel'},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},window:{dispatchEvent:event=>events.push(event),addEventListener(){},removeEventListener(){},setInterval:(callback,ms)=>(timers.push(ms),1),clearInterval(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},Event:class{constructor(type){this.type=type;}},require(name){if(name==='../lib/supabase')return{requireSupabase:()=>client};if(name==='../utils/checkout')return{buildOrderRequest:()=>({})};if(name==='./orderReportingService')return{queueAcceptedOrder(){},flushAcceptedOrders:async()=>{}};if(name==='./storeDefaults')return{};if(name==='../lib/localStore')return{};throw new Error(name);}});
 return{api:module.exports,events,callbacks,channels,timers};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
test('availability failure and absent RPC never retain a fake active storefront',async()=>{
 for(const result of [{data:null,error:{message:'not available',code:'PGRST202'}},{data:[],error:null}]){
  const {api,timers}=moduleFor(result),states=[];const stop=api.subscribeRemoteAvailability(id,value=>states.push(value));await flush();
  assert.equal(states.at(-1).status,'unavailable');assert.equal(timers[0],60_000);stop();
 }
});
test('availability invalidations requery authoritative state and preserve safe block fields',async()=>{
 const result={data:[{status:'maintenance',block_mode:'maintenance',block_message:'Texto <b>seguro</b>',block_until:'2030-01-01T00:00:00Z'}],error:null};
 const {api,callbacks}=moduleFor(result),states=[];const stop=api.subscribeRemoteAvailability(id,value=>states.push(value));await flush();
 assert.equal(states.at(-1).message,'Texto <b>seguro</b>');assert.equal(states.at(-1).status,'maintenance');
 result.data=[{status:'active'}];callbacks.get('managed_sites')();await flush();assert.equal(states.at(-1).status,'active');stop();
});
test('restricted account never opens operational channels or updates an order',async()=>{
 const {api,channels}=moduleFor();api.setConnectedStore({id,role:'owner',status:'active'},false);
 for(const name of ['subscribeRemoteOrders','subscribeRemoteCustomers','subscribeRemotePayments']){
  let seen;const stop=api[name](id,value=>{seen=value;});assert.equal(seen.length,0);stop();
 }
 assert.equal(channels.length,0);
 await assert.rejects(api.updateRemoteOrder(id,'order',{status:'preparando'}),/autorizada/);
});

