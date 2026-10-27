import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const compiled=transformSync(readFileSync(new URL('../src/services/connectService.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
const storeId='10000000-0000-4000-8000-000000000001',otherId='10000000-0000-4000-8000-000000000002';
function harness({status='active',member=true,httpStatus=200,payload={store_id:storeId,nx_id:'NX-OFFICIAL',integration_status:'connected'}}={}){
 const queries=[],calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null}),getSession:async()=>({data:{session:{access_token:'fake-token'}}})},
  functions:{invoke:async(name,body)=>{calls.push([name,body]);return httpStatus===200?{data:payload,error:null}:{data:null,error:{context:new Response(JSON.stringify(payload),{status:httpStatus})}};}},
  from(table){const q={table,filters:[]};queries.push(q);const chain={select(){return chain;},eq(k,v){q.filters.push([k,v]);return chain;},maybeSingle(){const permitted=q.filters.some(([k,v])=>k==='id'&&v===storeId)&&q.filters.some(([k,v])=>k==='nx_id'&&v==='NX-OFFICIAL');return Promise.resolve({data:table==='managed_sites'?(permitted?{id:storeId,nx_id:'NX-OFFICIAL',status,name:'Fixture',site_type:'delivery'}:null):(member?{role:'owner'}:null),error:null});}};return chain;}};
 const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,require:()=>({requireSupabase:()=>client}),Response,Error});
 return {...module.exports,queries,calls};
}
test('validates blocked account through current Auth and active membership rather than rejecting its store status',async()=>{
 const api=harness({status:'suspended'});const result=await api.validateOfficialStore(storeId,'NX-OFFICIAL');
 assert.equal(result.status,'suspended');assert.equal(result.role,'owner');
 assert.deepEqual(api.queries[1].filters,[['store_id',storeId],['user_id','owner'],['is_active',true]]);
});
test('wrong official store and lost membership cannot authorize account',async()=>{
 await assert.rejects(()=>harness().validateOfficialStore(otherId,'NX-OFFICIAL'));
 await assert.rejects(()=>harness({member:false}).validateOfficialStore(storeId,'NX-OFFICIAL'));
});
test('403 check-in keeps structured public state and reports denial rather than success',async()=>{
 const api=harness({httpStatus:403,payload:{error:'Bloqueada',status:'maintenance',block_mode:'maintenance',block_message:'Ajustes',block_until:'2026-10-26T12:00:00Z'}});
 await assert.rejects(()=>api.checkIn({id:storeId,nx_id:'NX-OFFICIAL'}),error=>error instanceof api.CentralActionError&&error.httpStatus===403&&error.block.status==='maintenance'&&error.block.message==='Ajustes'&&error.block.returnAt==='2026-10-26T12:00:00Z');
 assert.equal(api.calls[0][0],'novaesweb-admin');assert.deepEqual(Object.keys(api.calls[0][1].body),['action','nx_id']);assert.equal(api.calls[0][1].body.action,'site_checkin');
});
test('generic 403 grants no store state and mismatched check-in identity is rejected',async()=>{
 const denied=harness({httpStatus:403,payload:{error:'Sem vínculo'}});
 await assert.rejects(()=>denied.checkIn({id:storeId,nx_id:'NX-OFFICIAL'}),error=>error.httpStatus===403&&error.block===null);
 await assert.rejects(()=>harness({payload:{store_id:otherId,nx_id:'NX-OFFICIAL',integration_status:'connected'}}).checkIn({id:storeId,nx_id:'NX-OFFICIAL'}));
});

test('deployed check-in status_until field preserves the real return deadline',async()=>{
 const api=harness({httpStatus:403,payload:{error:'Manutenção informada pelo Master',status:'maintenance',status_until:'2026-11-01T15:00:00Z'}});
 await assert.rejects(api.checkIn({id:storeId,nx_id:'NX-OFFICIAL'}),error=>error.block.returnAt==='2026-11-01T15:00:00Z');
});
