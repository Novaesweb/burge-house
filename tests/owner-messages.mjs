import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const compiled=transformSync(readFileSync(new URL('../src/services/ownerMessageService.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',M='10000000-0000-4000-8000-000000000003';
function harness(user='owner-a',failure=false){
 const queries=[];
 const client={auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:null})},from(table){
  const query={table,filters:[],write:null,fields:null};queries.push(query);
  const chain={select(fields){query.fields=fields;return chain;},eq(k,v){query.filters.push([k,v]);return chain;},order(){return chain;},limit(){return Promise.resolve({data:[],error:failure?Error('denied'):null});},update(value){query.write=value;return chain;},maybeSingle(){return Promise.resolve({data:{id:M},error:failure?Error('denied'):null});}};
  return chain;
 }};
 const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,require:()=>({requireSupabase:()=>client}),Date,Error});
 return {...module.exports,queries};
}
test('mailboxes scope every read to selected store and the currently authenticated recipient',async()=>{
 const a=harness(),b=harness('owner-b');await a.getOwnerMessages(A);await b.getOwnerMessages(B);
 assert.deepEqual(a.queries[0].filters,[['store_id',A],['recipient_user_id','owner-a']]);
 assert.deepEqual(b.queries[0].filters,[['store_id',B],['recipient_user_id','owner-b']]);
 assert.equal(a.queries[0].table,'store_owner_messages');assert.equal(a.queries[0].fields,'id,store_id,recipient_user_id,category,title,body,created_at,read_at');
});
test('marking read only updates read_at and requires store, message and recipient filters',async()=>{
 const app=harness();await app.markOwnerMessageRead(A,M);const q=app.queries[0];
 assert.deepEqual(Object.keys(q.write),['read_at']);assert.ok(!Number.isNaN(Date.parse(q.write.read_at)));
 assert.deepEqual(q.filters,[['store_id',A],['recipient_user_id','owner-a'],['id',M]]);
});
test('missing authentication, malformed identifiers and database denial fail closed',async()=>{
 const noAuth=harness(null);await assert.rejects(()=>noAuth.getOwnerMessages(A));assert.equal(noAuth.queries.length,0);
 const app=harness();await assert.rejects(()=>app.getOwnerMessages('NX-ID'));await assert.rejects(()=>app.markOwnerMessageRead(A,'not-a-message'));assert.equal(app.queries.length,0);
 await assert.rejects(()=>harness('owner',true).getOwnerMessages(A));await assert.rejects(()=>harness('owner',true).markOwnerMessageRead(A,M));
});
test('unknown/nonactive statuses never authorize operations and restricted access requires owner/admin',()=>{
 const source=transformSync(readFileSync(new URL('../src/utils/storeAccess.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
 const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports});
 const {isStoreOperational,canUseRestrictedAccount,checkInRetryDelay}=module.exports;
 assert.equal(isStoreOperational('active'),true);for(const state of [undefined,'pending','maintenance','suspended','archived','unexpected'])assert.equal(isStoreOperational(state),false);
 assert.equal(canUseRestrictedAccount('owner'),true);assert.equal(canUseRestrictedAccount('admin'),true);assert.equal(canUseRestrictedAccount('staff'),false);assert.equal(canUseRestrictedAccount('viewer'),false);
 assert.deepEqual([1,2,3,4,5,6,20].map(checkInRetryDelay),[60000,120000,240000,480000,900000,900000,900000]);
});
