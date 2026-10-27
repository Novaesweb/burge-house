import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const compile=path=>transformSync(readFileSync(new URL(path,import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
const stateModule={exports:{}};vm.runInNewContext(compile('../src/utils/addonCommercialState.ts'),{module:stateModule,exports:stateModule.exports});
const {commercialState,isNewAddon}=stateModule.exports;
const store='10000000-0000-4000-8000-000000000001',addon='30000000-0000-4000-8000-000000000001',user='20000000-0000-4000-8000-000000000001';
function setup({role='owner',auth=true,siteType=null,catalog=[{id:addon,compatible_site_types:['*']}],requests=[],subscriptions=[],installationError=false,storeResponse=store}={}){
 const calls=[],writes=[],module={exports:{}};
 const client={auth:{getUser:async()=>({data:{user:auth?{id:user}:null},error:null})},from(table){
  const call={table,filters:[],selection:null};calls.push(call);
  const rows=()=>table==='store_members'?{role}:table==='managed_sites'?{id:storeResponse,site_type:siteType,status:'active'}:table==='addon_catalog'?catalog:table==='addon_requests'?requests:table==='store_addons'?subscriptions:[];
  const result=()=>({data:rows(),error:installationError&&table==='store_addon_installations'?{code:'NETWORK'}:null});
  const q={select(value){call.selection=value;return q;},eq(...args){call.filters.push(args);return q;},neq(...args){call.filters.push(args);return q;},order(){return Promise.resolve(result());},maybeSingle(){return Promise.resolve(result());},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);},insert(value){writes.push({table,value});return Promise.resolve({error:null});}};return q;
 }};
 vm.runInNewContext(compile('../src/services/addonService.ts'),{module,exports:module.exports,require(name){assert.equal(name,'../lib/supabase');return{requireSupabase:()=>client};}});
 return{api:module.exports,calls,writes};
}
test('commercial states distinguish request, preparation, activation and revocation without granting modules',()=>{
 for(const [status,label] of [['pending','Solicitado'],['in_review','Em análise'],['awaiting_confirmation','Aguardando confirmação'],['approved','Em preparo'],['rejected','Recusado']])assert.equal(commercialState({status}).label,label);
 assert.equal(commercialState({status:'approved'}).group,'preparing');
 assert.equal(commercialState({status:'approved'},{status:'active'},{development_status:'ready'},{technical_status:'available'}).group,'active');
 for(const status of ['disabled','suspended'])assert.equal(commercialState({status:'approved'},{status},{development_status:'ready'},{technical_status:'available'}).group,'disabled');
 for(const [request,development,technical] of [['rejected','ready','available'],['pending','ready','available'],['approved','planned','available'],['approved','ready','degraded']])assert.equal(commercialState({status:request},{status:'active'},{development_status:development},{technical_status:technical}).group,'disabled');
 assert.equal(commercialState({status:'unknown'}).canRequest,false);
 assert.equal(commercialState({status:'approved'},{status:'active'},{category:'service',development_status:'planned'}).group,'active');
});
test('new badge lasts seven days and rejects invalid or future dates',()=>{
 const now=Date.parse('2026-10-27T12:00:00Z');assert.equal(isNewAddon('2026-10-21T12:00:00Z',now),true);for(const date of ['bad','2026-10-28T12:00:00Z','2026-10-19T12:00:00Z'])assert.equal(isNewAddon(date,now),false);
});
test('catalog reuses four central tables, scoped to active manager and official store type; no guessed delivery type',async()=>{
 const {api,calls}=setup({catalog:[{id:addon,compatible_site_types:['*']},{id:'only-delivery',compatible_site_types:['delivery']},{id:'missing',compatible_site_types:null}]});
 const data=await api.getStoreAddonCatalog(store);assert.equal(data.catalog.length,1);assert.equal(data.installations.length,0);
 for(const table of ['addon_requests','store_addons','store_addon_installations'])assert.ok(calls.find(call=>call.table===table).filters.some(([field,value])=>field==='store_id'&&value===store));
 const filtered=setup({siteType:'delivery',catalog:[{id:addon,compatible_site_types:['delivery']}]});assert.equal((await filtered.api.getStoreAddonCatalog(store)).catalog.length,1);
});
test('missing session, staff, foreign store and check-in read failure never return a permissive catalog',async()=>{
 for(const options of [{auth:false},{role:'staff'},{storeResponse:'other-store'},{installationError:true}])await assert.rejects(setup(options).api.getStoreAddonCatalog(store));
});
test('request writes only own pending request and never catalog, entitlement, audit or check-in',async()=>{
 const {api,writes}=setup();await api.requestStoreAddon(store,addon);assert.equal(writes.length,1);assert.equal(writes[0].table,'addon_requests');
 assert.deepEqual(JSON.parse(JSON.stringify(writes[0].value)),{store_id:store,addon_id:addon,requested_by:user});
 for(const options of [{requests:[{addon_id:addon,status:'pending'}]},{subscriptions:[{addon_id:addon,status:'active'}]},{catalog:[]},{role:'staff'}]){
  const other=setup(options);await assert.rejects(other.api.requestStoreAddon(store,addon));assert.equal(other.writes.length,0);
 }
});
