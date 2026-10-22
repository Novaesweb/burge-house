import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../src/services/whatsappConnectionService.ts', import.meta.url), 'utf8');
const compiled = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
const storeId = '10000000-0000-4000-8000-000000000001';
const validStatus = { state: 'disconnected', expectedPhone: '5551990000000', instance: 'fixture-store' };

function service({ session = { access_token: 'fixture-session' }, response = { status: 200, body: validStatus }, fetchError } = {}) {
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, AbortSignal, Error, Object,
    require(name) {
      assert.equal(name, '../lib/supabase');
      return { requireSupabase: () => ({ auth: { getSession: async () => ({ data: { session }, error: null }) } }) };
    },
    fetch: async (...args) => {
      calls.push(args);
      if (fetchError) throw fetchError;
      return { ok: response.status < 400, status: response.status, json: async () => response.body };
    },
  });
  return { ...module.exports, calls };
}

test('status uses only authenticated same-origin GET, with no connection body', async () => {
  const client = service();
  const status = await client.getWhatsAppConnectionStatus(storeId);
  assert.equal(status.state, 'disconnected');
  const [url, options] = client.calls[0];
  assert.equal(url, `/api/whatsapp/${storeId}/status`);
  assert.equal(options.method, 'GET');
  assert.equal(options.body, undefined);
  assert.equal(options.cache, 'no-store');
  assert.equal(options.headers.Authorization, 'Bearer fixture-session');
  assert.equal(Object.keys(options.headers).length, 1);
});

test('connection POST sends explicit confirmation only when requested', async () => {
  const client = service();
  await client.connectWhatsApp(storeId);
  await client.connectWhatsApp(storeId, true);
  assert.equal(client.calls[0][0], `/api/whatsapp/${storeId}/connect`);
  assert.equal(client.calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(client.calls[0][1].body), { confirmSwitch: false });
  assert.deepEqual(JSON.parse(client.calls[1][1].body), { confirmSwitch: true });
});

test('missing auth and malformed store identifiers never reach the backend', async () => {
  const client = service({ session: null });
  await assert.rejects(client.getWhatsAppConnectionStatus(storeId), { code: 'UNAUTHENTICATED' });
  await assert.rejects(client.connectWhatsApp('../other-store'), { code: 'INVALID_STORE' });
  assert.equal(client.calls.length, 0);
});

test('switch-required and phone-in-use are safe actionable errors, without raw provider details', async () => {
  for (const code of ['CONFIRM_SWITCH_REQUIRED', 'PHONE_IN_USE']) {
    const client = service({ response: { status: 409, body: { code, error: 'sensitive provider internals' } } });
    await assert.rejects(client.connectWhatsApp(storeId), error => error.code === code && !error.message.includes('sensitive'));
  }
  const unavailable = service({ response: { status: 502, body: { code: 'UNKNOWN_SECRET', error: 'sensitive provider internals' } } });
  await assert.rejects(unavailable.connectWhatsApp(storeId), error => error.code === 'REQUEST_FAILED' && !error.message.includes('sensitive'));
});

test('QR parser permits only inline PNG and restricted pairing code, discarding untrusted response fields', () => {
  const client = service();
  const safe = client.parseWhatsAppStatus({ ...validStatus, qr: 'data:image/png;base64,YWJjZA==', pairingCode: 'ABCD-1234', apiKey: 'never expose' });
  assert.equal(safe.qr, 'data:image/png;base64,YWJjZA==');
  assert.equal(safe.pairingCode, 'ABCD-1234');
  assert.equal(safe.apiKey, undefined);
  for (const qr of ['https://third-party.invalid/qr.png', 'data:image/svg+xml;base64,YQ==', 'javascript:alert(1)']) {
    const unsafe = client.parseWhatsAppStatus({ ...validStatus, qr, pairingCode: '<script>bad</script>' });
    assert.equal(unsafe.qr, undefined);
    assert.equal(unsafe.pairingCode, undefined);
  }
  assert.throws(() => client.parseWhatsAppStatus({ ...validStatus, state: 'invented' }), { code: 'INVALID_RESPONSE' });
});

test('network failure reports unavailability without pretending connection succeeded', async () => {
  const client = service({ fetchError: new Error('private network details') });
  await assert.rejects(client.connectWhatsApp(storeId), error => error.code === 'SERVICE_UNAVAILABLE' && !error.message.includes('private'));
});
