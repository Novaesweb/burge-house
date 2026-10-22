import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { configuration, dependencies, controller, createHandler, ConnectionError } from '../backend/whatsapp/connectionServer.mjs';
import { instanceName } from '../backend/whatsapp/storeConnection.mjs';

// Synthetic accounts, stores and phones. No request reaches Supabase or WhatsApp.
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const user = '20000000-0000-4000-8000-000000000001';
const first = '5511900000001', second = '5511900000002', third = '5511900000003';
const context = { userId: user, storeId: A, expectedPhone: first };
const cfg = configuration({ SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', EVOLUTION_API_KEY: 'PRIVATE_EVOLUTION_FIXTURE' });
const ok = value => ({ ok: true, status: 200, json: async () => value });
const denies = (status, code) => error => error instanceof ConnectionError && error.status === status && error.code === code;

test('configuration refuses missing credentials and untrusted transport', () => {
  assert.throws(() => configuration({}), denies(503, 'SERVICE_UNAVAILABLE'));
  assert.throws(() => configuration({ SUPABASE_URL: cfg.supabaseUrl, SUPABASE_PUBLISHABLE_KEY: cfg.publicKey, EVOLUTION_API_KEY: 'fixture', EVOLUTION_URL: 'http://external.test' }));
});

test('backend verifies Auth and active owner/admin membership under the same user JWT', async () => {
  const calls = [];
  const api = dependencies(cfg, async (url, opts) => {
    calls.push(url);
    assert.equal(opts.headers.Authorization, 'Bearer fixture-user-token');
    assert.equal(opts.headers.apikey, cfg.publicKey);
    assert.equal(opts.redirect, 'error');
    if (url.includes('/auth/')) return ok({ id: user });
    if (url.includes('/store_members')) {
      assert.match(url, /is_active=eq.true/); assert.match(url, new RegExp('user_id=eq.' + user)); return ok([{ role: 'owner' }]);
    }
    if (url.includes('/managed_sites')) return ok([{ id: A, status: 'active' }]);
    return ok([{ payload: { phone: '(11) 90000-0001' } }]);
  });
  assert.deepEqual(await api.authorize('fixture-user-token', A), context);
  assert.equal(calls.length, 4);
});

test('anonymous, expired, unrelated, inactive, staff and viewer users cannot reach Evolution', async () => {
  for (const role of [null, 'staff', 'viewer']) {
    let calls = 0;
    const api = dependencies(cfg, async url => {
      ++calls;
      return url.includes('/auth/') ? ok({ id: user }) : ok(role ? [{ role }] : []);
    });
    await assert.rejects(api.authorize('fixture', B), denies(403, 'ACCESS_DENIED'));
    assert.equal(calls, 2);
  }
  await assert.rejects(dependencies(cfg, async () => ({ ok: false, status: 401 })).authorize('expired', A), denies(401, 'AUTH_REQUIRED'));
  await assert.rejects(dependencies(cfg, async () => ok({})).authorize('anonymous', A), denies(401, 'AUTH_REQUIRED'));
});

test('suspended, inaccessible stores and invalid saved phones fail closed', async () => {
  for (const state of ['suspended', 'maintenance', null]) {
    const api = dependencies(cfg, async url => ok(url.includes('/auth/') ? { id: user } : url.includes('/store_members') ? [{ role: 'admin' }] : state ? [{ id: A, status: state }] : []));
    await assert.rejects(api.authorize('fixture', A), denies(403, 'STORE_UNAVAILABLE'));
  }
  const api = dependencies(cfg, async url => ok(url.includes('/auth/') ? { id: user } : url.includes('/store_members') ? [{ role: 'admin' }] : url.includes('/managed_sites') ? [{ id: A, status: 'active' }] : [{ payload: { phone: '' } }]));
  await assert.rejects(api.authorize('fixture', A), denies(400, 'INVALID_PHONE'));
});

function provider(rows = []) {
  const instances = new Map(rows.map(row => [row.name, row]));
  const calls = [];
  let beforeConnect;
  const evolution = async (route, method = 'GET', body) => {
    calls.push({ route, method, body });
    if (route === 'instance/fetchInstances') return [...instances.values()];
    if (route.startsWith('instance/fetchInstances?')) return [...instances.values()].filter(row => row.name === route.split('=')[1]);
    if (route === 'instance/create') {
      instances.set(body.instanceName, { name: body.instanceName, connectionStatus: 'close', token: 'PRIVATE_PROVIDER_TOKEN' });
      return { hash: 'PRIVATE_PROVIDER_TOKEN' };
    }
    const name = route.split('/')[2]?.split('?')[0];
    if (route.startsWith('instance/logout/')) { instances.set(name, { name, connectionStatus: 'close' }); return {}; }
    if (route.startsWith('instance/connect/')) {
      await beforeConnect?.();
      instances.set(name, { name, connectionStatus: 'connecting' });
      return { base64: 'data:image/png;base64,aGVsbG8=', pairingCode: 'ABCD-1234', token: 'PRIVATE_PROVIDER_TOKEN', code: 'RAW_PROVIDER_CODE' };
    }
    throw new Error('UNEXPECTED_ROUTE');
  };
  return { instances, calls, evolution, setBeforeConnect(fn) { beforeConnect = fn; } };
}

test('status is read-only, scoped to UUID and strips all provider credentials', async () => {
  const p = provider([{ name: instanceName(A), connectionStatus: 'open', ownerJid: first + '@s.whatsapp.net', token: 'PRIVATE_PROVIDER_TOKEN' }]);
  const status = await controller(p)(context, 'status');
  assert.deepEqual(status, { state: 'connected', instance: instanceName(A), expectedPhone: first, connectedPhone: first });
  assert.equal(p.calls.length, 1); assert.equal(p.calls[0].method, 'GET');
  assert.equal((await controller(p)({ ...context, storeId: B }, 'status')).state, 'not_created');
});

test('explicit connect provisions only its own instance and returns sanitized QR fields', async () => {
  const p = provider([{ name: 'novaesweb_teste', connectionStatus: 'open', ownerJid: third + '@s.whatsapp.net' }]);
  const result = await controller(p)(context, 'connect');
  assert.equal(result.state, 'connecting'); assert.match(result.qr, /^data:image\/png/); assert.equal(result.pairingCode, 'ABCD-1234');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|RAW_PROVIDER_CODE|token|hash/);
  assert.equal(p.calls.find(call => call.route === 'instance/create').body.instanceName, instanceName(A));
  assert.ok(p.calls.filter(call => call.method !== 'GET').every(call => !call.route.includes('novaesweb_teste')));
});

test('three phone changes require confirmation and affect only the same store instance', async () => {
  const p = provider([{ name: instanceName(B), connectionStatus: 'open', ownerJid: '5511900000099@s.whatsapp.net' }]);
  const perform = controller(p);
  for (const [index, phone] of [first, second, third].entries()) {
    const ctx = { ...context, expectedPhone: phone };
    if (index) await assert.rejects(perform(ctx, 'connect'), denies(409, 'CONFIRM_SWITCH_REQUIRED'));
    await perform(ctx, 'connect', { confirmSwitch: true });
    p.instances.set(instanceName(A), { name: instanceName(A), connectionStatus: 'open', ownerJid: phone + '@s.whatsapp.net' });
    assert.equal((await perform(ctx, 'status')).state, 'connected');
  }
  assert.equal(p.calls.filter(call => call.method === 'DELETE').length, 2);
  assert.ok(p.calls.filter(call => call.method === 'DELETE').every(call => call.route === 'instance/logout/' + instanceName(A)));
  assert.equal(p.instances.get(instanceName(B)).ownerJid, '5511900000099@s.whatsapp.net');
});

test('phone already bound to another instance cannot be reassigned or exposed', async () => {
  const p = provider([{ name: instanceName(B), connectionStatus: 'open', ownerJid: first + '@s.whatsapp.net' }]);
  await assert.rejects(controller(p)(context, 'connect'), denies(409, 'PHONE_IN_USE'));
  assert.ok(p.calls.every(call => call.method === 'GET'));
});

test('parallel connect is rejected instead of disconnecting an in-progress session', async () => {
  const p = provider();
  let entered, release;
  const active = new Promise(resolve => { entered = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  p.setBeforeConnect(async () => { entered(); await hold; });
  const perform = controller(p), firstConnect = perform(context, 'connect');
  await active;
  await assert.rejects(perform(context, 'connect'), denies(409, 'BUSY'));
  release(); await firstConnect;
});

async function http(handler, { path = `/api/whatsapp/${A}/status`, method = 'GET', data = '', headers = {} } = {}) {
  const req = Readable.from(data ? [data] : []);
  Object.assign(req, { url: path, method, headers: { host: '127.0.0.1:3012', authorization: 'Bearer synthetic-user-token-123456', ...headers } });
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.data = JSON.parse(value); } };
  await handler(req, response);
  return response;
}

test('HTTP rejects invalid origin, host, token and arbitrary instance parameters before authorization', async () => {
  let calls = 0;
  const handler = createHandler(cfg, { authorize: async () => { calls++; return context; }, evolution: async () => [] });
  for (const input of [{ headers: { origin: 'https://foreign.test' } }, { headers: { host: 'foreign.test' } }, { headers: { authorization: '' } }, { method: 'POST', path: `/api/whatsapp/${A}/connect`, data: '{"instance":"other-store"}' }]) {
    assert.ok((await http(handler, input)).statusCode >= 400);
  }
  assert.equal(calls, 0);
});

test('HTTP never returns raw errors, sets no-store and rate-limits connect attempts', async () => {
  const p = provider([{ name: instanceName(A), connectionStatus: 'open', ownerJid: first + '@s.whatsapp.net' }]);
  const handler = createHandler(cfg, { ...p, authorize: async () => context });
  const get = await http(handler); assert.equal(get.statusCode, 200); assert.equal(get.headers['Cache-Control'], 'no-store');
  for (let i = 0; i < 8; i++) assert.equal((await http(handler, { method: 'POST', path: `/api/whatsapp/${A}/connect` })).statusCode, 200);
  assert.equal((await http(handler, { method: 'POST', path: `/api/whatsapp/${A}/connect` })).statusCode, 429);
  const broken = createHandler(cfg, { authorize: async () => { throw new Error('secret fixture'); } });
  assert.deepEqual((await http(broken)).data, { code: 'SERVICE_UNAVAILABLE' });
});
