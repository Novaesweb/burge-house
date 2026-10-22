import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { instanceName, normalizePhone } from './storeConnection.mjs';

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export class ConnectionError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new ConnectionError(status, code); };
export function configuration(env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseUrl || '') || !publicKey?.startsWith('sb_publishable_')) fail(503, 'SERVICE_UNAVAILABLE');
  const url = new URL(env.EVOLUTION_URL || 'http://127.0.0.1:8080');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) fail(503, 'SERVICE_UNAVAILABLE');
  const origins = (env.WHATSAPP_PANEL_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001').split(',');
  if (origins.some(origin => { try { return new URL(origin).origin !== origin; } catch { return true; } })) fail(503, 'SERVICE_UNAVAILABLE');
  if (!env.EVOLUTION_API_KEY) fail(503, 'SERVICE_UNAVAILABLE');
  return { supabaseUrl, publicKey, url: url.origin, key: env.EVOLUTION_API_KEY, origins };
}

async function readJson(response, code) {
  try { return await response.json(); } catch { fail(502, code); }
}
export function dependencies(cfg, request = fetch) {
  async function central(path, token) {
    let response;
    try {
      response = await request(`${cfg.supabaseUrl}/${path}`, {
        redirect: 'error', signal: AbortSignal.timeout(12000),
        headers: { apikey: cfg.publicKey, Authorization: `Bearer ${token}` },
      });
    } catch { fail(503, 'SERVICE_UNAVAILABLE'); }
    if (response.status === 401) fail(401, 'AUTH_REQUIRED');
    if (!response.ok) fail(403, 'ACCESS_DENIED');
    return readJson(response, 'SERVICE_UNAVAILABLE');
  }
  return {
    async authorize(token, storeId) {
      // Validate with Auth, then query with the same user token under existing RLS.
      // Neither a browser-supplied store_id nor editable metadata proves access.
      const user = await central('auth/v1/user', token);
      if (!UUID.test(user?.id || '')) fail(401, 'AUTH_REQUIRED');
      const members = await central(`rest/v1/store_members?select=role&store_id=eq.${storeId}&user_id=eq.${user.id}&is_active=eq.true`, token);
      if (!Array.isArray(members) || members.length !== 1 || !['owner', 'admin'].includes(members[0].role)) fail(403, 'ACCESS_DENIED');
      const stores = await central(`rest/v1/managed_sites?select=id,status&id=eq.${storeId}`, token);
      if (!Array.isArray(stores) || stores.length !== 1 || stores[0].id !== storeId || stores[0].status !== 'active') fail(403, 'STORE_UNAVAILABLE');
      const settings = await central(`rest/v1/delivery_settings?select=payload&store_id=eq.${storeId}`, token);
      let expectedPhone;
      try {
        if (!Array.isArray(settings) || settings.length !== 1) throw new Error();
        expectedPhone = normalizePhone(settings[0].payload?.phone);
      } catch { fail(400, 'INVALID_PHONE'); }
      return { userId: user.id, storeId, expectedPhone };
    },
    async evolution(route, method = 'GET', body) {
      let response;
      try {
        response = await request(`${cfg.url}/${route}`, {
          method, redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch { fail(502, 'EVOLUTION_UNAVAILABLE'); }
      if (response.status === 404 && route.startsWith('instance/fetchInstances?')) return [];
      if (!response.ok) fail(502, 'EVOLUTION_UNAVAILABLE');
      return readJson(response, 'EVOLUTION_UNAVAILABLE');
    },
  };
}
function connectedPhone(item) {
  const match = /^([0-9]{12,13})(?::[0-9]+)?@s\.whatsapp\.net$/.exec(item?.ownerJid || '');
  return match?.[1] || null;
}
export function publicStatus(context, item) {
  const instance = instanceName(context.storeId);
  if (item && item.name !== instance) fail(502, 'EVOLUTION_UNAVAILABLE');
  const actual = connectedPhone(item);
  const state = !item ? 'not_created' : actual && actual !== context.expectedPhone ? 'number_mismatch' :
    item.connectionStatus === 'open' && actual === context.expectedPhone ? 'connected' :
      item.connectionStatus === 'connecting' ? 'connecting' : 'disconnected';
  // Whitelist fields: Evolution responses can contain administrative credentials.
  return { state, instance, expectedPhone: context.expectedPhone, ...(actual ? { connectedPhone: actual } : {}) };
}
function qrFields(raw) {
  const data = raw?.qrcode || raw;
  const result = {};
  if (typeof data?.base64 === 'string' && data.base64.length <= 1_000_000 && /^data:image\/png;base64,[A-Za-z0-9+/=\r\n]+$/.test(data.base64)) result.qr = data.base64.replace(/[\r\n]/g, '');
  if (typeof data?.pairingCode === 'string' && /^[A-Za-z0-9-]{4,32}$/.test(data.pairingCode)) result.pairingCode = data.pairingCode;
  return result;
}
export function controller(deps) {
  const locks = new Set();
  async function find(name) {
    const rows = await deps.evolution(`instance/fetchInstances?instanceName=${name}`);
    if (!Array.isArray(rows)) fail(502, 'EVOLUTION_UNAVAILABLE');
    return rows.find(item => item.name === name) || null;
  }
  return async function perform(context, action, args = {}) {
    const name = instanceName(context.storeId);
    if (action === 'status') return publicStatus(context, await find(name));
    if (action !== 'connect') fail(404, 'NOT_FOUND');
    if (locks.has(name)) fail(409, 'BUSY');
    locks.add(name);
    try {
      let item = await find(name);
      if (publicStatus(context, item).state === 'connected') return publicStatus(context, item);
      const all = await deps.evolution('instance/fetchInstances');
      if (!Array.isArray(all)) fail(502, 'EVOLUTION_UNAVAILABLE');
      if (all.some(row => row.name !== name && connectedPhone(row) === context.expectedPhone)) fail(409, 'PHONE_IN_USE');
      if (!item) {
        // Provision only after an explicit authorized POST; reads never create stores or instances.
        await deps.evolution('instance/create', 'POST', { instanceName: name, integration: 'WHATSAPP-BAILEYS', qrcode: false });
        item = await find(name);
        if (!item) fail(502, 'EVOLUTION_UNAVAILABLE');
      }
      if (connectedPhone(item) && connectedPhone(item) !== context.expectedPhone) {
        if (args.confirmSwitch !== true) fail(409, 'CONFIRM_SWITCH_REQUIRED');
        if (item.connectionStatus === 'open') await deps.evolution(`instance/logout/${name}`, 'DELETE');
      }
      const qr = qrFields(await deps.evolution(`instance/connect/${name}?number=${context.expectedPhone}`));
      const status = publicStatus(context, await find(name));
      return { ...status, ...(status.state === 'connected' ? {} : qr) };
    } finally { locks.delete(name); }
  };
}

async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 2048) fail(413, 'INVALID_REQUEST');
  }
  try {
    const parsed = JSON.parse(data || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      Object.keys(parsed).some(key => key !== 'confirmSwitch') ||
      ('confirmSwitch' in parsed && typeof parsed.confirmSwitch !== 'boolean')) throw new Error();
    return parsed;
  } catch { fail(400, 'INVALID_REQUEST'); }
}
export function createHandler(cfg, deps = dependencies(cfg)) {
  const perform = controller(deps), limits = new Map();
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.headers.origin && !cfg.origins.includes(req.headers.origin)) fail(403, 'ACCESS_DENIED');
      if (!['127.0.0.1:3012', 'localhost:3012'].includes(req.headers.host)) fail(403, 'ACCESS_DENIED');
      const match = /^\/api\/whatsapp\/([a-f0-9-]{36})\/(status|connect)$/.exec(req.url || '');
      if (!match || !UUID.test(match[1])) fail(404, 'NOT_FOUND');
      const [, storeId, action] = match;
      if (req.method !== (action === 'status' ? 'GET' : 'POST')) fail(405, 'METHOD_NOT_ALLOWED');
      const token = /^Bearer ([A-Za-z0-9_.-]{20,8192})$/.exec(req.headers.authorization || '')?.[1];
      if (!token) fail(401, 'AUTH_REQUIRED');
      const args = action === 'connect' ? await body(req) : {};
      const context = await deps.authorize(token, storeId);
      const now = Date.now(), key = `${context.userId}:${storeId}:${action}`;
      if (limits.size > 5000) { for (const [id, entry] of limits) if (entry.until <= now) limits.delete(id); }
      if (limits.size > 5000) fail(429, 'RATE_LIMIT');
      const entry = limits.get(key);
      const next = !entry || entry.until <= now ? { until: now + 60_000, count: 1 } : { ...entry, count: entry.count + 1 };
      limits.set(key, next);
      if (next.count > (action === 'status' ? 60 : 8)) fail(429, 'RATE_LIMIT');
      const result = await perform(context, action, args);
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = error instanceof ConnectionError ? error.status : 503;
      res.end(JSON.stringify({ code: error instanceof ConnectionError ? error.code : 'SERVICE_UNAVAILABLE' }));
    }
  };
}
async function main() {
  const env = { ...process.env };
  if (!env.EVOLUTION_API_KEY && env.EVOLUTION_KEY_FILE) {
    env.EVOLUTION_API_KEY = (await readFile(env.EVOLUTION_KEY_FILE, 'utf8')).trim();
  }
  const cfg = configuration(env);
  const server = createServer(createHandler(cfg));
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;
  server.on('error', () => { console.error('WHATSAPP_CONNECTION_SERVER_UNAVAILABLE'); process.exitCode = 1; });
  server.listen(3012, '127.0.0.1', () => console.log('WHATSAPP_CONNECTION_SERVER_READY: 127.0.0.1:3012'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('WHATSAPP_CONNECTION_SERVER_UNAVAILABLE'); process.exitCode = 1; });
}
