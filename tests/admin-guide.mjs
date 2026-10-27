import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const compile=path=>transformSync(readFileSync(new URL(path,import.meta.url),'utf8'),{loader:path.endsWith('.tsx')?'tsx':'ts',format:'cjs'}).code;
function load(code,require,globals={}){const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require,...globals});return module.exports;}
const content=load(compile('../src/utils/adminGuideContent.ts'),()=>{throw new Error('UNEXPECTED_DEPENDENCY');});
const menuSource=readFileSync(new URL('../src/components/admin/AdminLayout.tsx',import.meta.url),'utf8').split('] as const;')[0];
const areas=[...menuSource.matchAll(/id: '([^']+)'/g)].map(match=>match[1]);
function environment({blocked=false}={}){
 const values=new Map(),listeners=new Map();
 const localStorage={getItem:key=>{if(blocked)throw new Error('blocked');return values.get(key)||null;},setItem(key,value){if(blocked)throw new Error('blocked');values.set(key,value);}};
 const window={addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);}};
 class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
 return{values,window,localStorage,CustomEvent};
}
function harness({env=environment(),kind='panel',enabled=false,restricted=false,allowed=areas}={}){
 const slots=[],effects=[],navigations=[];let position=0,dirty=true,output;
 let state={siteId:'store-a',adminView:'dashboard',setAdminView(view){navigations.push(view);state.adminView=view;dirty=true;}};
 let connection={session:{user:{id:'user-a'}},store:{id:'store-a',role:'owner',status:'active'}};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={
  useState(initial){const key=position++;if(!slots[key])slots[key]={value:typeof initial==='function'?initial():initial};const slot=slots[key];return[slot.value,next=>{const value=typeof next==='function'?next(slot.value):next;if(!Object.is(value,slot.value)){slot.value=value;dirty=true;}}];},
  useRef(value){const key=position++;if(!slots[key])slots[key]={current:value};return slots[key];},
  useMemo(fn,deps){const key=position++;if(!slots[key]||!same(slots[key].deps,deps))slots[key]={value:fn(),deps};return slots[key].value;},
  useCallback(fn,deps){return hooks.useMemo(()=>fn,deps);},
  useEffect(fn,deps){const key=position++,previous=slots[key];if(!previous||!same(previous.deps,deps)){const slot={deps,cleanup:previous?.cleanup};slots[key]=slot;effects.push(()=>{slot.cleanup?.();slot.cleanup=fn();});}},
  createElement(type,props,...children){return{type,props:{...props,children}};},
 };
 const guideHook=load(compile('../src/hooks/useAdminGuide.ts'),name=>{assert.equal(name,'react');return hooks;},env);
 const key=guideHook.guideStorageKey(state.siteId,connection.session.user.id);
 if(enabled)env.values.set(key,JSON.stringify({enabled:true,steps:{}}));
 const Component=kind==='hook'?null:load(compile(kind==='settings'?'../src/components/admin/AdminGuideSettings.tsx':'../src/components/admin/AdminGuidePanel.tsx'),name=>{
  if(name==='react')return hooks;if(name==='lucide-react')return new Proxy({},{get:(_,name)=>name});
  if(name.endsWith('/StoreContext'))return{useStore:()=>state};if(name.endsWith('/ConnectContext'))return{useConnect:()=>connection};
  if(name.endsWith('/useAdminGuide'))return guideHook;if(name.endsWith('/adminGuideContent'))return content;if(name.endsWith('.css'))return{};
  throw new Error(`Unexpected dependency: ${name}`);
 },env)[kind==='settings'?'AdminGuideSettings':'AdminGuidePanel'];
 const render=(effectsEnabled=true)=>{let rounds=0;do{if(++rounds>30)throw new Error('HOOK_LOOP');position=0;dirty=false;output=kind==='hook'?guideHook.useAdminGuide(state.siteId,connection.session?.user.id):Component({allowedAreas:allowed,restricted,onNavigate:state.setAdminView});if(effectsEnabled)while(effects.length)effects.shift()();}while(effectsEnabled&&dirty);return output;};
 render();return{env,key,navigations,guideHook,get value(){return output;},render,changeIdentity(store,user){state={...state,siteId:store};connection={session:user?{user:{id:user}}:null,store:{id:store,role:'owner',status:'active'}};return render(false);},setView(view){state.adminView=view;return render();},unmount(){for(const slot of slots)slot?.cleanup?.();},setPreferences(value){env.localStorage.setItem(key,JSON.stringify(value));env.window.dispatchEvent(new env.CustomEvent(guideHook.GUIDE_EVENT,{detail:{key,preferences:value}}));return render();}};
}
const nodes=tree=>tree&&typeof tree==='object'?[tree,...(tree.props?.children||[]).flatMap(child=>Array.isArray(child)?child.flatMap(nodes):nodes(child))]:[];
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):tree&&typeof tree==='object'?(tree.props?.children||[]).flat(Infinity).map(text).join(''):'';
function click(app,label){const node=nodes(app.value).find(node=>node.type==='button'&&text(node)===label);assert.ok(node,`button ${label}`);assert.ok(!node.props.disabled,`${label} enabled`);node.props.onClick();app.render();}

test('guide covers every real navigation area with unique readable steps and essential safety explanations',()=>{
 assert.equal(areas.length,15);
 const chapters=content.guideChapters(areas);assert.equal(chapters.length,areas.length);
 for(const {area,chapter} of chapters){assert.ok(chapter.steps.length>0,area);assert.equal(new Set(chapter.steps.map(step=>step.id)).size,chapter.steps.length);for(const item of chapter.steps){assert.ok(item.body.length>30);assert.ok(item.details.length>0);}}
 const all=JSON.stringify(content.ADMIN_GUIDE);for(const phrase of ['exclusão','consentimento','não envia WhatsApp real','Zero Bloqueio','pendente de pagamento','não abre nem envia chamados','ao sair do campo'])assert.ok(all.toLowerCase().includes(phrase.toLowerCase()),phrase);
});
test('search handles accents, multiple words, topics in other areas and restricted access',()=>{
 const chapters=content.guideChapters(areas);assert.ok(content.searchGuide(chapters,'impressao').some(result=>result.area==='orders'));assert.ok(content.searchGuide(chapters,'Pix pagamento').length>0);
 const restricted=content.guideChapters(areas,true);assert.deepEqual(JSON.parse(JSON.stringify(restricted.map(item=>item.area))),['account','messages','support']);assert.equal(content.searchGuide(restricted,'cadastrar produto').length,0);
 assert.equal(content.searchGuide(chapters,'').length,0);
});
test('guide starts disabled, persists choices/progress and synchronizes settings and panel without server calls',()=>{
 const env=environment(),settings=harness({env,kind:'settings'}),panel=harness({env});assert.equal(panel.value,null);
 const toggle=nodes(settings.value).find(node=>node.type==='input');assert.equal(toggle.props.checked,false);toggle.props.onChange({target:{checked:true}});settings.render();panel.render();assert.ok(text(panel.value).includes('Como usar o painel'));
 click(panel,'Próximo');assert.ok(text(panel.value).includes('Loja aberta, conta e acesso'));assert.equal(JSON.parse(env.values.get(panel.key)).steps.dashboard,'store-status');
 const reload=harness({env});assert.ok(text(reload.value).includes('Loja aberta, conta e acesso'));
 click(panel,'Recolher');assert.ok(!text(panel.value).includes('Este guia explica sem executar ações.'));click(panel,'Abrir guia');click(panel,'Desativar passo a passo');assert.equal(panel.value,null);settings.render();assert.equal(nodes(settings.value).find(node=>node.type==='input').props.checked,false);
 settings.unmount();panel.unmount();reload.unmount();
});
test('new account/store hides previous preference immediately; blocked storage keeps a session-only guide and warning',()=>{
 const app=harness({kind:'hook',enabled:true});app.value.update({steps:{dashboard:'revenue'}});app.render();assert.equal(app.value.preferences.enabled,true);
 const next=app.changeIdentity('store-b','user-b');assert.equal(next.preferences.enabled,false);assert.equal(Object.keys(next.preferences.steps).length,0);app.render();assert.equal(app.value.preferences.enabled,false);
 const blocked=harness({kind:'hook',env:environment({blocked:true})});blocked.value.update({enabled:true});blocked.render();assert.equal(blocked.value.preferences.enabled,true);assert.ok(blocked.value.warning.includes('sessão'));app.unmount();blocked.unmount();
});
test('guide can search, change area, restart and complete using navigation only; no operational actions are imported',()=>{
 const app=harness({enabled:true});const select=nodes(app.value).find(node=>node.type==='select');select.props.onChange({target:{value:'orders'}});app.render();assert.deepEqual(app.navigations,['orders']);assert.ok(text(app.value).includes('Cada etapa tem seu espaço'));
 const search=nodes(app.value).find(node=>node.type==='input');search.props.onChange({target:{value:'QR'}});app.render();const result=nodes(app.value).find(node=>node.type==='button'&&text(node).includes('Conectar ou trocar o WhatsApp'));assert.ok(result);result.props.onClick();app.render();assert.equal(app.navigations.at(-1),'settings');assert.ok(text(app.value).includes('Aparelhos conectados'));
 app.setView('extras');app.setPreferences({enabled:true,steps:{extras:'coupons'}});click(app,'Concluir guia');assert.ok(text(app.value).includes('Guia concluído'));
 const settings=harness({kind:'settings',env:app.env});click(settings,'Começar / reiniciar guia completo');assert.equal(settings.navigations.at(-1),'dashboard');assert.deepEqual(JSON.parse(app.env.values.get(app.key)).steps,{});app.unmount();settings.unmount();
});
test('limited account guide never offers operational sections or overrides permissions',()=>{
 const app=harness({enabled:true,restricted:true});const options=nodes(app.value).filter(node=>node.type==='option').map(node=>node.props.value);assert.deepEqual(options,['account','messages','support']);assert.ok(text(app.value).includes('Entender o acesso limitado'));
 const select=nodes(app.value).find(node=>node.type==='select');select.props.onChange({target:{value:'orders'}});app.render();assert.equal(app.navigations.length,0);app.unmount();
});
