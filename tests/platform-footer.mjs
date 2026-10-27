import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import vm from 'node:vm';
import {PlatformSignature,PlatformVersionBadge} from '../src/components/PlatformSignature.tsx';
import {ENGINE_VERSION} from '../src/config/platform.ts';
const nativeRequire=createRequire(import.meta.url);
function component(path,exportName){
 const module={exports:{}};const state={siteSettings:{name:'Loja & Teste',phone:'51999999999',address:'Rua Exemplo, 100',openingHours:'18h às 23h',isOpen:true},storeAdmin:{name:'Pessoa Teste'},orders:[],adminView:'dashboard'};
 vm.runInNewContext(transformSync(readFileSync(new URL(path,import.meta.url),'utf8'),{loader:'tsx',format:'cjs'}).code,{module,exports:module.exports,require(name){
  if(name.endsWith('/StoreContext'))return{useStore:()=>state};
  if(name.endsWith('/ConnectContext'))return{useConnect:()=>({session:{user:{id:'owner'}},store:{name:'Loja & Teste',role:'owner',status:'active'}})};
  if(name.endsWith('/PlatformSignature'))return{PlatformSignature,PlatformVersionBadge};
  if(name.endsWith('/GlobalOrderNotifications'))return{GlobalOrderNotifications:()=>null};
  if(name.endsWith('/AdminGuidePanel'))return{AdminGuidePanel:()=>null};
  if(name.endsWith('/adminOrders'))return{whatsappNumber:value=>'55'+value};
  if(name.endsWith('.png'))return'/logo.png';if(name.endsWith('.css'))return{};
  return nativeRequire(name);
 }});return module.exports[exportName];
}
test('institutional signature escapes store name and renders safe official link, current year and shared version',()=>{
 const html=renderToStaticMarkup(React.createElement(PlatformSignature,{storeName:'Loja <script>Teste</script>'}));
 for(const text of ['Feito com','❤️','NovaesWeb','https://novaesweb.com.br','target="_blank"','rel="noopener noreferrer"','v5.2',String(new Date().getFullYear()),'Todos os direitos reservados','Loja &lt;script&gt;Teste&lt;/script&gt;'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('<script>'));assert.equal(ENGINE_VERSION,'5.2');
});
test('public footer preserves contact, address, hours, legal links and owner access',()=>{
 const Footer=component('../src/components/Footer.tsx','Footer');const html=renderToStaticMarkup(React.createElement(Footer));
 for(const text of ['Loja &amp; Teste','51999999999','Rua Exemplo, 100','18h às 23h','https://wa.me/5551999999999','#/privacidade','#/termos','Painel do Dono','novaesweb-footer-signature','v5.2'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/novaesweb-footer-signature/g)||[]).length,1);
});
test('owner sidebar shows version badge in both operational and restricted account modes',()=>{
 const Layout=component('../src/components/admin/AdminLayout.tsx','AdminLayout');
 for(const restricted of [false,true]){
  const html=renderToStaticMarkup(React.createElement(Layout,{restricted},'Conteúdo preservado'));
  for(const text of ['novaesweb-version-badge','NovaesWeb Commerce Engine — Versão 5.2','v5.2 • Sistema Atualizado','Pessoa Teste','Ver minha loja','Conteúdo preservado'])assert.ok(html.includes(text),text);
 }
});
