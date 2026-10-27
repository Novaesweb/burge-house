import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const compiled=transformSync(readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')+'\nexport { DeliveryAppContent };',{loader:'tsx',format:'cjs'}).code;
function render({status='active',role='owner',view='orders',denied=false,availability=status}={}){
 const module={exports:{}};
 const hooks={useState:()=>[null,()=>{}],useEffect(){},createElement(type,props,...children){return {type,props:{...props,children}};}};
 const connection={session:{user:{id:'owner',email:'fixture@example.invalid'}},store:{id:'official-store',status,role},checkInDenied:denied,checkInBlock:null};
 const state={adminView:view,customerView:'home',siteSettings:{status:'active'},storeAvailability:{status:availability},categories:[],isLoading:false};
 vm.runInNewContext(compiled,{module,exports:module.exports,require(name){
  if(name==='react')return hooks;if(name==='./context/StoreContext')return {useStore:()=>state};if(name==='./context/ConnectContext')return {useConnect:()=>connection};
  if(name==='./utils/storeAccess')return {isStoreOperational:s=>s==='active',canUseRestrictedAccount:r=>['owner','admin'].includes(r),storeStatusLabel:s=>s};
  return new Proxy({},{get:(_o,key)=>key});
 }});
 return module.exports.DeliveryAppContent({isAdmDonoRoute:true});
}
const nodes=tree=>tree&&typeof tree==='object'?[tree,...(tree.props?.children||[]).flatMap(child=>Array.isArray(child)?child.flatMap(nodes):nodes(child))]:[];
test('blocked owner/admin retain only account, messages and support and never mount order pages',()=>{
 for(const role of ['owner','admin'])for(const status of ['pending','maintenance','suspended','archived']){
  const tree=render({role,status});assert.equal(tree.type,'AdminLayout');assert.equal(tree.props.restricted,true);
  assert.equal(nodes(tree).some(node=>node.type==='AdminOrders'),false);
  assert.equal(nodes(render({role,status,view:'messages'})).some(node=>node.type==='AdminOwnerMessages'),true);
  assert.equal(nodes(render({role,status,view:'support'})).some(node=>node.type==='AdminSupport'),true);
 }
});
test('blocked staff, generic denial and unavailable status cannot mount operational routes',()=>{
 assert.equal(render({role:'staff',status:'suspended'}).type,'ConnectGate');
 assert.equal(render({denied:true}).props.restricted,true);
 assert.equal(render({availability:'unavailable'}).props.restricted,true);
});
test('active store retains the existing orders page',()=>{
 const tree=render();assert.equal(tree.type,'AdminLayout');assert.equal(nodes(tree).some(node=>node.type==='AdminOrders'),true);
});
