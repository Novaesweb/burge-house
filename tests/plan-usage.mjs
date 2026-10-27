import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const nativeRequire = createRequire(import.meta.url);
const storeId = '10000000-0000-4000-8000-000000000001';
const otherStore = '10000000-0000-4000-8000-000000000002';
const fixture = (overrides = {}) => ({ store_id: storeId, nx_id: 'NX-FIXTURE', store_name: 'Loja local', plan_code: 'NOVAES_BUSINESS', competence: '2026-10-01', franchise_orders: 340, accepted_count: 10, voided_count: 0, daily: [{ day: '2026-10-02', accepted_count: 10 }], overage_tariff: null, billing_active: true, plan_started_at: null, plan_expires_at: null, payment_status: 'not_informed', ...overrides });
const compiled = path => transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), { loader: path.endsWith('.tsx') ? 'tsx' : 'ts', format: 'cjs', jsx: 'automatic' }).code;
const serviceCode = compiled('../src/services/planUsageService.ts');
function client({ session = { user: { id: 'local-user' } }, authError = null, data = fixture(), error = null, networkFailure = false, role='owner', monthlyEmpty=false } = {}) {
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(serviceCode, { module, exports: module.exports, URL, Date, Error, require(name) {
    assert.equal(name, '../lib/supabase');
    return { requireSupabase: () => ({ auth: { getUser: async () => ({ data: { user:session?.user }, error: authError }) }, rpc(name,args){assert.equal(name,'novaesweb_order_competence');assert.equal(args.p_ts,'now');return Promise.resolve({data:'2026-10-01',error});}, from(table) {
      assert.ok(['managed_sites','store_members','store_order_usage_monthly','store_order_lifecycle_summary','store_order_usage_events'].includes(table));
      const call={table,filters:[],selection:''};calls.push(call);
      const result=()=>{
        if(networkFailure)throw new Error('private network debug information');
        const row=table==='managed_sites'?{...data,id:storeId,name:data.store_name}:table==='store_members'?{role}:table==='store_order_usage_monthly'?(monthlyEmpty?[]:[data]):table==='store_order_lifecycle_summary'?data:[{id:'event',accepted_at:'2026-10-02T12:00:00Z'}];
        // Daily fixture stores ten accepted events, represented as distinct rows.
        return {data:table==='store_order_usage_events'?Array.from({length:data.accepted_count},(_,i)=>({id:`e${i}`,accepted_at:'2026-10-02T12:00:00Z'})):row,error};
      };
      const q={select(value){call.selection=value;return q;},eq(...args){call.filters.push(args);return q;},order(){return q;},limit(){return Promise.resolve(result());},maybeSingle(){return Promise.resolve(result());},range(){return Promise.resolve(result());}};
      return q;
    } }) };
  } });
  return { ...module.exports, calls };
}
function widget(connection = {}, staleState) {
  const module = { exports: {} };
  const service = client();
  vm.runInNewContext(compiled('../src/components/admin/StoreOrderUsageWidget.tsx'), { module, exports: module.exports, Date, Intl, Error, require(name) {
    if (name === '../../services/planUsageService') return service;
    if (name === '../../services/orderReportingService') return {localReportingHealth:()=>({pending_count:0,review_count:0})};
    if (name === '../../context/ConnectContext') return { useConnect: () => connection };
    if (name === 'react' && staleState) return { ...React, useState: initial => [typeof initial === 'number' ? initial : staleState, () => {}], useEffect: () => {} };
    return nativeRequire(name);
  } });
  return module.exports;
}

test('usage reads existing own-store views and technical events only, with active owner membership', async () => {
  const api = client();
  const result = await api.loadPlanUsage(storeId);
  assert.equal(result.accepted_count, 10);
  assert.equal(api.calls.length, 5);
  for(const call of api.calls)assert.ok(call.filters.some(([field,value])=>['id','store_id'].includes(field)&&value===storeId));
  assert.equal(api.calls.find(call=>call.table==='store_order_usage_events').selection,'id,accepted_at');
  assert.equal(result.competence,'2026-10-01');
  assert.equal(result.franchise_orders,340);
});
test('invalid store, missing session and auth error prevent the RPC', async () => {
  const missing = client({ session: null });
  await assert.rejects(missing.loadPlanUsage(storeId), { code: 'UNAUTHENTICATED' });
  await assert.rejects(missing.loadPlanUsage('NX-public'), { code: 'INVALID_STORE' });
  assert.equal(missing.calls.length, 0);
  const failedAuth = client({ authError: { message: 'expired' } });
  await assert.rejects(failedAuth.loadPlanUsage(storeId), { code: 'UNAUTHENTICATED' });
  assert.equal(failedAuth.calls.length, 0);
});
test('empty central history uses server competence and never invents a contractual tariff', async () => {
  const result=await client({monthlyEmpty:true}).loadPlanUsage(storeId);
  assert.equal(result.competence,'2026-10-01');assert.equal(result.accepted_count,0);assert.equal(result.overage_tariff,null);
  assert.equal(result.daily.length,0);
});

test('Start performs no usage query, staff cannot read the widget and foreign store responses fail closed',async()=>{
  const start=client({data:fixture({plan_code:'NOVAES_START'})});await start.loadPlanUsage(storeId);assert.equal(start.calls.length,2);
  await assert.rejects(client({role:'staff'}).loadPlanUsage(storeId),{code:'UNAVAILABLE'});
  await assert.rejects(client({data:fixture({store_id:otherStore})}).loadPlanUsage(storeId),{code:'UNAVAILABLE'});
});
test('permission and transport failures expose safe errors without fake counts', async () => {
  for (const options of [{ error: { code: '42501', message: 'private SQL detail' } }, { networkFailure: true }]) {
    await assert.rejects(client(options).loadPlanUsage(storeId), error => error.code === 'UNAVAILABLE' && !error.message.includes('private'));
  }
});
test('response rejects another store and projects out unexpected commercial/customer fields', () => {
  const api = client();
  assert.throws(() => api.parsePlanUsage(fixture({ store_id: otherStore }), storeId), { code: 'INVALID_RESPONSE' });
  const result = api.parsePlanUsage(fixture({ customer_phone: 'private', total_sales: 999, unrelated: { secret: 'private' } }), storeId);
  assert.equal(result.customer_phone, undefined);
  assert.equal(result.total_sales, undefined);
  assert.equal(result.unrelated, undefined);
});
test('unknown and missing plans remain unknown, including contractual franchise', () => {
  const api = client();
  for (const code of [null, 'CUSTOM_CONTRACT']) {
    const result = api.parsePlanUsage(fixture({ plan_code: code, franchise_orders: null }), storeId);
    assert.equal(result.plan_code, code);
    assert.equal(api.planUsageMetrics(result).percentage, null);
    assert.notEqual(api.planName(code), 'Novaes Business');
  }
});
test('80 and 100 percent alerts never change order permissions; excess retains actual count', () => {
  const api = client();
  for (const [accepted, level] of [[271, 'normal'], [272, 'attention'], [340, 'reached'], [400, 'reached']]) {
    const data = fixture({ accepted_count: accepted });
    const result = api.planUsageMetrics(data);
    assert.equal(result.level, level);
    assert.ok(result.progress <= 100);
    assert.equal(data.accepted_count, accepted);
    assert.equal(result.blocked, undefined);
  }
  assert.equal(api.planUsageMetrics(fixture({ accepted_count: 400 })).overage, 60);
});
test('history validates dates within server competence, without deriving browser month', () => {
  const api = client();
  assert.equal(api.parsePlanUsage(fixture({ competence: '2025-02-01', daily: [{ day: '2025-02-28', accepted_count: 1 }] }), storeId).competence, '2025-02-01');
  for (const daily of [[{ day: '2026-11-01', accepted_count: 1 }], [{ day: '2026-10-32', accepted_count: 1 }], [{ day: '2026-10-02', accepted_count: -1 }], [{ day: '2026-10-02', accepted_count: 1 }, { day: '2026-10-02', accepted_count: 1 }]]) {
    assert.throws(() => api.parsePlanUsage(fixture({ daily }), storeId), { code: 'INVALID_RESPONSE' });
  }
});
test('settings URL preserves hash and other parameters and supports general/plan sections', () => {
  const api = client();
  const url = api.settingsSectionUrl('http://localhost:3001/?origem=local#/admdono', 'plano');
  assert.equal(api.settingsSectionFromUrl(url), 'plano');
  assert.equal(new URL(url).hash, '#/admdono');
  assert.equal(new URL(url).searchParams.get('origem'), 'local');
  assert.equal(api.settingsSectionFromUrl(api.settingsSectionUrl(url, 'geral')), 'geral');
});
test('rendered summary displays safe content, zero blockage and unknown tariff without invented charge', () => {
  const { PlanUsageSummary } = widget();
  const html = renderToStaticMarkup(React.createElement(PlanUsageSummary, { data: fixture({ store_name: '<script>unsafe</script>', accepted_count: 400 }) }));
  assert.ok(html.includes('Zero bloqueio por franquia'));
  assert.ok(html.includes('Tarifa contratual de excedentes não informada'));
  assert.ok(html.includes('Histórico diário'));
  assert.ok(html.includes('aria-valuenow="100"'));
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('R$'));
});
test('Start renders no delivery franchise; contract plan remains explicit', () => {
  const { PlanUsageSummary } = widget();
  const start = renderToStaticMarkup(React.createElement(PlanUsageSummary, { data: fixture({ plan_code: 'NOVAES_START', franchise_orders: null }) }));
  assert.ok(start.includes('não inclui franquia'));
  assert.ok(!start.includes('role="progressbar"'));
  const contract = renderToStaticMarkup(React.createElement(PlanUsageSummary, { data: fixture({ plan_code: 'NOVAES_EMPRESARIAL', franchise_orders: null }) }));
  assert.ok(contract.includes('Novaes Empresarial'));
  assert.ok(contract.includes('A confirmar'));
});
test('widget refuses unauthenticated and non-owner/admin users', () => {
  for (const connection of [{}, { session: { user: { id: 'fixture' } }, store: { id: storeId, role: 'viewer' } }, { session: { user: { id: 'fixture' } }, store: { id: storeId, role: 'staff' } }]) {
    const { StoreOrderUsageWidget } = widget(connection);
    const html = renderToStaticMarkup(React.createElement(StoreOrderUsageWidget));
    assert.ok(html.includes('proprietário e administrador autenticados'));
    assert.ok(!html.includes('Pedidos aceitos'));
  }
});
test('store/account switch hides prior usage synchronously before the refresh effect', () => {
  const previous = { identity: `previous-user:${storeId}`, data: fixture({ store_name: 'PRIVATE PREVIOUS STORE' }), error: '', loading: false };
  const { StoreOrderUsageWidget } = widget({ session: { user: { id: 'new-user' } }, store: { id: otherStore, role: 'owner' } }, previous);
  const html = renderToStaticMarkup(React.createElement(StoreOrderUsageWidget));
  assert.ok(html.includes('Consultando o plano'));
  assert.ok(!html.includes('PRIVATE PREVIOUS STORE'));
});
