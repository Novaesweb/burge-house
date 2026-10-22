import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source=readFileSync(new URL('../src/context/ConnectContext.tsx',import.meta.url),'utf8');
const compiled=transformSync(source,{loader:'tsx',format:'cjs',define:{'import.meta.env':'TEST_ENV'}}).code;
const session=(id='owner',token='first')=>({user:{id},access_token:token});
const official={id:'official-store',nx_id:'official-nx',name:'Loja de teste',status:'active',role:'owner',site_type:'delivery'};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

// Executes the actual provider with deterministic hooks and mocked Auth/network.
// This tests lifecycle races without credentials, browser or a live database.
function harness({initial=session(),sessionRead,validate=async()=>({...official}),checkIn=async()=>{}}={}){
 const slots=[],effects=[],listeners=new Map(),intervals=new Set();
 let index=0,dirty=true,output,authListener,current=initial,validationCalls=0,checkInCalls=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 const hooks={
  createContext:()=>({Provider:'provider'}),useContext:()=>output,
  useState(initialValue){const key=index++;if(!slots[key])slots[key]={value:typeof initialValue==='function'?initialValue():initialValue};const slot=slots[key];return [slot.value,next=>{const value=typeof next==='function'?next(slot.value):next;if(!Object.is(value,slot.value)){slot.value=value;dirty=true;}}];},
  useRef(value){const key=index++;if(!slots[key])slots[key]={current:value};return slots[key];},
  useCallback(callback,deps){const key=index++;if(!slots[key]||!same(slots[key].deps,deps))slots[key]={deps,callback};return slots[key].callback;},
  useEffect(callback,deps){const key=index++;const previous=slots[key];if(!previous||!same(previous.deps,deps)){slots[key]={deps,cleanup:previous?.cleanup};effects.push(()=>{slots[key].cleanup?.();slots[key].cleanup=callback();});}},
  createElement(_type,props){output=props.value;return output;},
 };
 const client={auth:{
  onAuthStateChange(callback){authListener=callback;return {data:{subscription:{unsubscribe(){authListener=null;}}}};},
  getSession:()=>sessionRead?.promise??Promise.resolve({data:{session:current}}),
  signOut:async()=>{current=null;authListener?.('SIGNED_OUT',null);return {error:null};},
 }};
 const service={
  validateOfficialStore:async(...args)=>{validationCalls++;return validate(...args);},
  checkIn:async(...args)=>{checkInCalls++;return checkIn(...args);},
  getRegistrationStatus:async()=>{throw Error('Unexpected registration path');},
 };
 const module={exports:{}};
 vm.runInNewContext(compiled,{
  module,exports:module.exports,require(name){if(name==='react')return hooks;if(name==='../lib/supabase')return {supabase:client};if(name==='../services/connectService')return service;throw Error(name);},
  TEST_ENV:{VITE_NOVAESWEB_STORE_ID:'official-store',VITE_NOVAESWEB_NX_ID:'official-nx'},
  localStorage:{getItem:()=>null},
  window:{setInterval(callback){intervals.add(callback);return callback;},clearInterval(callback){intervals.delete(callback);}},
  document:{visibilityState:'visible',addEventListener(name,callback){listeners.set(name,callback);},removeEventListener(name,callback){if(listeners.get(name)===callback)listeners.delete(name);}},
  Date,Error,console,
 });
 function render(){index=0;dirty=false;module.exports.ConnectProvider({children:null});while(effects.length)effects.shift()();}
 return {
  async settle(){for(let n=0;n<30;n++){if(dirty)render();await Promise.resolve();}return output;},
  get value(){return output;},get validationCalls(){return validationCalls;},get checkInCalls(){return checkInCalls;},
  emit(event,next){current=next;authListener(event,next);},
  focus(){listeners.get('visibilitychange')?.();},
  poll(){for(const callback of intervals)callback();},
 };
}

test('stored session validates automatically before showing the access screen',async()=>{
 const pending=deferred();const app=harness({validate:()=>pending.promise});
 await app.settle();assert.equal(app.value.loading,true);assert.equal(app.value.store,null);assert.equal(app.validationCalls,1);
 pending.resolve(official);await app.settle();assert.equal(app.value.loading,false);assert.equal(app.value.store.id,official.id);
});
test('token refresh and repeated sign-in for the same user never clear a validated store',async()=>{
 const app=harness();await app.settle();const store=app.value.store;
 app.emit('TOKEN_REFRESHED',session('owner','renewed'));await app.settle();
 assert.equal(app.value.store,store);assert.equal(app.value.loading,false);assert.equal(app.validationCalls,1);
 app.emit('SIGNED_IN',session('owner','focus-event'));await app.settle();assert.equal(app.value.store,store);assert.equal(app.validationCalls,1);
});
test('background checks keep the panel mounted while validation is running',async()=>{
 let pending;const app=harness({validate:()=>pending?pending.promise:Promise.resolve(official)});await app.settle();
 pending=deferred();app.focus();await app.settle();assert.equal(app.value.store.id,official.id);assert.equal(app.value.loading,false);
 pending.resolve({...official});await app.settle();assert.equal(app.value.store.id,official.id);assert.equal(app.checkInCalls,1);
});
test('loss of membership fails closed and account changes cannot reuse old validation',async()=>{
 let failure=false;const app=harness({validate:async()=>{if(failure)throw Error('Sem vínculo ativo');return official;}});await app.settle();
 failure=true;app.poll();await app.settle();assert.equal(app.value.store,null);assert.equal(app.value.error,'Sem vínculo ativo');
 app.emit('SIGNED_IN',session('other-owner'));await app.settle();assert.equal(app.value.store,null);assert.equal(app.value.session.user.id,'other-owner');
});
test('sign-out invalidates in-flight validation and a late session read cannot restore it',async()=>{
 const read=deferred();const validation=deferred();const app=harness({sessionRead:read,validate:()=>validation.promise});await app.settle();
 app.emit('SIGNED_IN',session());await app.settle();app.emit('SIGNED_OUT',null);await app.settle();
 validation.resolve(official);read.resolve({data:{session:session()}});await app.settle();
 assert.equal(app.value.session,null);assert.equal(app.value.store,null);assert.equal(app.value.loading,false);
});
test('session renewal preserves password recovery and store status is never forced to active',async()=>{
 const app=harness({validate:async()=>({...official,status:'maintenance'})});await app.settle();assert.equal(app.value.store.status,'maintenance');
 app.emit('PASSWORD_RECOVERY',session());await app.settle();assert.equal(app.value.recoveryMode,true);
 app.emit('TOKEN_REFRESHED',session('owner','new'));await app.settle();assert.equal(app.value.recoveryMode,true);
});
