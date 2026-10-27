import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const compile=path=>transformSync(readFileSync(new URL(path,import.meta.url),'utf8'),{loader:path.endsWith('.tsx')?'tsx':'ts',format:'cjs'}).code;
const utilsModule={exports:{}};vm.runInNewContext(compile('../src/utils/adminOrders.ts'),{module:utilsModule,exports:utilsModule.exports,URL,Date});
const order=(id,status='recebido',siteId='store-a')=>({id,siteId,status,orderNumber:1,createdAt:'2026-10-27T10:00:00Z'});
function mount(component,{mode='customer',accepted=true,connection,initialOrders=[],activeOrder=null,sharedStorage=new Map()}={}){
 const slots=[],effects=[],intervals=new Map(),timeouts=new Map(),listeners=new Map(),sounds=[],views=[];
 let index=0,dirty=true,output,timer=0;
 let state={orders:initialOrders,appMode:mode,siteId:'store-a',activeOrder,setCustomerView:value=>views.push(value),setAdminView(){},setSelectedAdminOrder(){}};
 let auth=connection??{session:{user:{id:'owner'}},store:{id:'store-a',status:'active',role:'owner'},checkInDenied:false};
 if(accepted)sharedStorage.set('delivery_sound_accepted','true');
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 const hooks={
  useState(initial){const key=index++;if(!slots[key])slots[key]={value:typeof initial==='function'?initial():initial};const slot=slots[key];return[slot.value,next=>{const value=typeof next==='function'?next(slot.value):next;if(!Object.is(value,slot.value)){slot.value=value;dirty=true;}}];},
  useRef(value){const key=index++;if(!slots[key])slots[key]={current:value};return slots[key];},
  useMemo(fn,deps){const key=index++;if(!slots[key]||!same(slots[key].deps,deps))slots[key]={value:fn(),deps};return slots[key].value;},
  useCallback(fn,deps){return hooks.useMemo(()=>fn,deps);},
  useEffect(fn,deps){const key=index++,previous=slots[key];if(!previous||!same(previous.deps,deps)){const slot={deps,cleanup:previous?.cleanup};slots[key]=slot;effects.push(()=>{slot.cleanup?.();slot.cleanup=fn();});}},
  createElement(type,props,...children){return{type,props:{...props,children}};},
 };
 const audio=new Proxy({ORDER_SOUND_EVENT:'order-sound-state',getAudioContextState:()=> 'running',getOrderSoundMuteUntil:()=>0,isOrderSoundMuted:()=>false,unlockAudio:async()=>true},{get(target,name){return name in target?target[name]:(...args)=>sounds.push({name,args});}});
 const module={exports:{}};
 const add=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);};
 const remove=(name,fn)=>listeners.get(name)?.delete(fn);
 const storage={getItem:key=>sharedStorage.get(key)??null,setItem:(key,value)=>sharedStorage.set(key,value)};
 const setInterval=(fn,ms)=>{const id=++timer;intervals.set(id,{fn,ms});return id;};const clearInterval=id=>intervals.delete(id);
 const setTimeout=(fn,ms)=>{const id=++timer;timeouts.set(id,{fn,ms});return id;};const clearTimeout=id=>timeouts.delete(id);
 vm.runInNewContext(compile(component),{module,exports:module.exports,Date,Map,Set,URL,setInterval,clearInterval,setTimeout,clearTimeout,localStorage:storage,sessionStorage:storage,
  window:{setInterval,clearInterval,setTimeout,clearTimeout,addEventListener:add,removeEventListener:remove,location:{href:'http://localhost/#/admdono'},history:{pushState(){}},dispatchEvent(){}},PopStateEvent:class{},
  require(name){if(name==='react')return hooks;if(name.endsWith('/StoreContext'))return{useStore:()=>state};if(name.endsWith('/ConnectContext'))return{useConnect:()=>auth};if(name.endsWith('/audioAlert'))return audio;if(name.endsWith('/adminOrders'))return utilsModule.exports;if(name==='lucide-react')return new Proxy({},{get:(_,name)=>name});throw new Error(name);}});
 const render=()=>{let rounds=0;do{if(++rounds>20)throw new Error('HOOK_LOOP');index=0;dirty=false;output=module.exports[component.includes('GlobalOrder')?'GlobalOrderNotifications':'AudioNotificationBanner']();while(effects.length)effects.shift()();}while(dirty);return output;};
 render();
 return{sounds,views,intervals,get output(){return output;},update(value){state={...state,...value};return render();},auth(value){auth=value;return render();},tick(){for(const {fn} of [...intervals.values()])fn();render();},unmount(){for(const slot of slots)slot?.cleanup?.();},emit(name){for(const fn of listeners.get(name)||[])fn();render();}};
}
const publicPath='../src/components/AudioNotificationBanner.tsx',adminPath='../src/components/admin/GlobalOrderNotifications.tsx';
test('public order arrival and overdue orders never start the administrative chime or its repeating timer',()=>{
 const app=mount(publicPath,{activeOrder:order('mine'),initialOrders:[order('mine')]});
 app.update({orders:[order('mine'),order('another')]});for(let i=0;i<20;i++)app.tick();
 assert.equal(app.sounds.length,0);assert.equal(app.intervals.size,0);app.unmount();
});
test('customer hears only their tracked order status once; other orders and stores remain silent',()=>{
 const mine=order('mine');const app=mount(publicPath,{activeOrder:mine,initialOrders:[mine,order('another')]});
 app.update({orders:[mine,order('another','entregue')]});assert.equal(app.sounds.length,0);
 const ready={...mine,status:'preparando'};app.update({orders:[ready,order('another','entregue')]});assert.deepEqual(app.sounds.map(x=>x.name),['playStatusChangeSound']);
 app.update({orders:[{...ready}]});assert.equal(app.sounds.length,1);
 app.update({orders:[{...mine,status:'entregue'}]});assert.deepEqual(app.sounds.map(x=>x.name),['playStatusChangeSound','playSuccessSound']);assert.deepEqual(app.views,['order-delivered']);
 app.update({activeOrder:order('mine','entregue','store-b'),orders:[order('mine','preparando','store-b')]});assert.equal(app.sounds.length,2);app.unmount();
});
test('customer consent, switching tracked order and admin mode never replay a new-order alert',()=>{
 const mine=order('mine');const app=mount(publicPath,{accepted:false,activeOrder:mine,initialOrders:[mine]});app.update({orders:[{...mine,status:'preparando'}]});assert.equal(app.sounds.length,0);
 const second=order('second','entregue');app.update({activeOrder:second,orders:[second]});assert.equal(app.views.length,0);
 app.update({appMode:'admin',orders:[{...second,status:'preparando'}]});assert.equal(app.output,null);assert.equal(app.sounds.length,0);app.unmount();
});
test('admin alert requires admin panel, valid session, matching active store and authorized role',()=>{
 for(const connection of [{session:null,store:{id:'store-a',status:'active',role:'owner'}},{session:{},store:{id:'store-b',status:'active',role:'owner'}},{session:{},store:{id:'store-a',status:'suspended',role:'owner'}},{session:{},store:{id:'store-a',status:'active',role:'viewer'}},{session:{},store:{id:'store-a',status:'active',role:'owner'},checkInDenied:true}]){
  const app=mount(adminPath,{mode:'admin',connection,initialOrders:[order('new')]});assert.equal(app.output,null);assert.equal(app.sounds.some(call=>call.name==='startOrderAlertLoop'),false);app.unmount();
 }
 const publicTab=mount(adminPath,{mode:'customer',initialOrders:[order('new')]});assert.equal(publicTab.sounds.some(call=>call.name==='startOrderAlertLoop'),false);publicTab.unmount();
});
test('admin queue stays audible after accepting one, and stops on empty queue, logout or unmount',()=>{
 const app=mount(adminPath,{mode:'admin',initialOrders:[order('one'),order('two')]});assert.equal(app.sounds.filter(x=>x.name==='startOrderAlertLoop').length,1);
 app.update({orders:[order('one','preparando'),order('two')]});assert.equal(app.sounds.filter(x=>x.name==='startOrderAlertLoop').length,1);
 app.update({orders:[order('one','preparando'),order('two','preparando')]});assert.equal(app.sounds.at(-1).name,'stopOrderAlertLoop');
 app.update({orders:[order('three')]});assert.equal(app.sounds.at(-1).name,'startOrderAlertLoop');app.auth({session:null,store:null});assert.equal(app.sounds.at(-1).name,'stopOrderAlertLoop');app.unmount();
});
test('public and admin tabs sharing sound preference keep administrative alerts exclusively in the admin tab',()=>{
 const sharedStorage=new Map([['delivery_sound_accepted','true']]);const mine=order('mine');
 const customer=mount(publicPath,{sharedStorage,initialOrders:[mine],activeOrder:mine});const admin=mount(adminPath,{sharedStorage,mode:'admin',initialOrders:[mine]});
 customer.update({orders:[mine,order('next')]});customer.emit('storage');admin.update({orders:[mine,order('next')]});
 assert.equal(customer.sounds.length,0);assert.equal(admin.sounds.filter(x=>x.name==='startOrderAlertLoop').length,1);
 customer.update({orders:[order('mine','preparando')]});assert.deepEqual(customer.sounds.map(x=>x.name),['playStatusChangeSound']);
 admin.update({appMode:'customer'});assert.equal(admin.sounds.at(-1).name,'stopOrderAlertLoop');customer.unmount();admin.unmount();
});
