import { pathToFileURL, fileURLToPath } from 'node:url';
import { open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { database, fileJournal, phone } from '../whatsapp/worker.mjs';

export const STORE = 'e2ba2dff-0b92-497d-9b08-926c235c2934';
export function configuration(env) {
  if (env.MARKETING_STORE_ID !== STORE) throw new Error('STORE_NOT_AUTHORIZED');
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL || '') ||
      !env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_') ||
      !/^[a-f0-9]{64}$/.test(env.MARKETING_WORKER_TOKEN || '')) throw new Error('INVALID_DATABASE_CONFIG');
  const url = new URL(env.EVOLUTION_URL);
  if (url.origin !== 'http://127.0.0.1:8080' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('EVOLUTION_MUST_BE_LOOPBACK');
  if (!/^[\w-]+$/.test(env.EVOLUTION_INSTANCE || '') || !env.EVOLUTION_API_KEY) throw new Error('INVALID_EVOLUTION_CONFIG');
  return {
    store: STORE, token: env.MARKETING_WORKER_TOKEN, url: url.origin,
    key: env.EVOLUTION_API_KEY, instance: env.EVOLUTION_INSTANCE,
    sendEnabled: env.MARKETING_SEND_ENABLED === 'true' && env.MARKETING_ACTIVATION_CONFIRMED === STORE,
  };
}
export function rpcClient(env, cfg, request = fetch) {
  const db = database(env, request);
  return async (operation, args = {}) => {
    const { data, error } = await db.rpc('bh_marketing_worker', {
      p_store_id: cfg.store, p_token: cfg.token, p_operation: operation, p_args: args,
    });
    if (error) throw new Error('DATABASE_' + operation.toUpperCase() + '_FAILED');
    return data;
  };
}
async function evolution(cfg, route, body, request) {
  const response = await request(`${cfg.url}/${route}/${encodeURIComponent(cfg.instance)}`, {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error('EVOLUTION_REQUEST_FAILED');
  return response.json();
}
export async function verifyInstance(cfg, expectedPhone, request = fetch) {
  // FetchInstances returns credentials in some versions. Never log its response.
  const response = await request(`${cfg.url}/instance/fetchInstances?instanceName=${encodeURIComponent(cfg.instance)}`, {
    redirect: 'error', signal: AbortSignal.timeout(10000), headers: { apikey: cfg.key },
  });
  if (!response.ok) throw new Error('INSTANCE_UNAVAILABLE');
  const rows = await response.json();
  const item = Array.isArray(rows) ? rows.find(x => x.name === cfg.instance) : null;
  if (!item || item.connectionStatus !== 'open' || item.ownerJid !== `${expectedPhone}@s.whatsapp.net`) throw new Error('INSTANCE_BINDING_MISMATCH');
}
export function incoming(record) {
  const key = record?.key;
  // Evolution's fromMe:false filter is ignored by some versions; enforce it here.
  if (key?.fromMe !== false || typeof key.id !== 'string' || !key.id || key.id.length > 150) return null;
  const text = record?.message?.conversation ?? record?.message?.extendedTextMessage?.text;
  if (typeof text !== 'string' || !/^(SAIR|ACEITO PROMOCOES [a-f0-9-]{36})$/i.test(text.trim())) return null;
  const direct = /^55\d{10,11}@s\.whatsapp\.net$/;
  const jid = direct.test(key.remoteJid || '') ? key.remoteJid :
    /@lid$/.test(key.remoteJid || '') && direct.test(key.remoteJidAlt || '') ? key.remoteJidAlt : null;
  // An authenticated provider may supply a verified alternative number for LID.
  // Never ignore a direct opt-out just because its number cannot be resolved.
  if (!jid) {
    if (/@lid$/.test(key.remoteJid || '') && text.trim().toUpperCase() === 'SAIR') throw new Error('UNRESOLVED_OPTOUT_REVIEW_REQUIRED');
    return null;
  }
  const stamp = Number(record.messageTimestamp);
  if (!Number.isFinite(stamp) || stamp <= 0) return null;
  return { phone: phone(jid.split('@')[0]), text: text.trim(), timestamp: new Date(stamp * 1000).toISOString(), provider_id: key.id };
}
export async function synchronize(rpc, cfg, request = fetch, clock = () => new Date()) {
  const status = await rpc('status');
  await verifyInstance(cfg, status.phone, request);
  const until = clock().toISOString();
  if (!Number.isFinite(Date.parse(status.cursor))) throw new Error('INVALID_INBOUND_CURSOR');
  const records = [];
  let expectedPages, expectedTotal;
  for (let page = 1; ; page++) {
    const result = await evolution(cfg, 'chat/findMessages', {
      // Scan retained history, not a send-timestamp cursor: an offline client's
      // SAIR may arrive today with a timestamp from yesterday.
      where: {}, page, offset: 50,
    }, request);
    const messages = result?.messages;
    if (!Array.isArray(messages?.records) || !Number.isInteger(messages.pages) || messages.pages < 0 || messages.pages > 200 || !Number.isInteger(messages.total) || messages.total < 0 || messages.pages !== Math.ceil(messages.total / 50)) throw new Error('INBOUND_RESPONSE_OR_BACKLOG');
    // A changing result set cannot be certified as fully synchronized.
    if (expectedPages !== undefined && (expectedPages !== messages.pages || expectedTotal !== messages.total)) throw new Error('INBOUND_CHANGED_RETRY');
    expectedPages = messages.pages;
    expectedTotal = messages.total;
    records.push(...messages.records);
    if (page >= messages.pages) break;
  }
  if (records.length !== expectedTotal || new Set(records.map(r => r.id)).size !== records.length) throw new Error('INBOUND_INCOMPLETE_RETRY');
  const events = records.map(incoming).filter(Boolean).sort((a,b) => a.timestamp.localeCompare(b.timestamp) || (a.text.toUpperCase() === 'SAIR' ? 1 : -1));
  for (const event of events) await rpc('inbound', event);
  // Only advance after processing every page. Replay after failure is deduplicated in Postgres.
  await rpc('synced', { until });
  return status;
}
export async function deliver(job, cfg, request = fetch) {
  if (!cfg.sendEnabled) return { state: 'uncertain', code: 'LOCAL_SENDING_DISABLED' };
  if (job.store_id !== cfg.store || !job.text || job.text.length > 2000) return { state: 'uncertain', code: 'INVALID_JOB' };
  let number;
  try { number = phone(job.phone); } catch { return { state:'uncertain', code:'INVALID_PHONE' }; }
  try {
    const response = await evolution(cfg, 'message/sendText', { number, text: job.text, linkPreview: false }, request);
    return typeof response?.key?.id === 'string' && response.key.id.length > 0 && response.key.id.length <= 150
      ? { state: 'accepted', code: 'PROVIDER_ACCEPTED', provider_id: response.key.id }
      : { state: 'uncertain', code: 'INVALID_PROVIDER_RESPONSE' };
  } catch { return { state: 'uncertain', code: 'PROVIDER_RESULT_UNKNOWN' }; }
}
export async function tick(rpc, cfg, journal, request = fetch) {
  if (!cfg.sendEnabled) return false;
  const saved = await journal.load() || { claim_id: randomUUID(), phase: 'claim' };
  await journal.save(saved);
  const job = await rpc('claim', { claim_id: saved.claim_id });
  if (!job || !['claimed','sending'].includes(job.state)) { await journal.save(null); return false; }
  let result = saved.result;
  if (saved.phase === 'dispatching') result = { state: 'uncertain', code: 'RECOVERY_AFTER_DISPATCH' };
  if (!result) {
    const permission = await rpc('authorize', { claim_id: saved.claim_id });
    if (!permission.allowed) { if (permission.terminal) await journal.save(null); return false; }
    await journal.save({ ...saved, phase: 'dispatching' });
    result = await deliver(job, cfg, request);
  }
  await journal.save({ ...saved, phase: 'finish', result });
  await rpc('finish', { claim_id: saved.claim_id, ...result });
  await journal.save(null);
  return true;
}
async function main() {
  const cfg = configuration(process.env), rpc = rpcClient(process.env, cfg);
  const lockPath = fileURLToPath(new URL('./.marketing.lock', import.meta.url));
  // Exclusive process lock. A stale lock requires manual review of the journal.
  const lock = await open(lockPath, 'wx', 0o600);
  try {
    const status = await rpc('status');
    await verifyInstance(cfg, status.phone);
    if (process.argv.includes('--check')) { console.log('MARKETING_CONFIGURATION_OK; sending=' + cfg.sendEnabled); return; }
    const journal = fileJournal(fileURLToPath(new URL('./.marketing-claim.json', import.meta.url)));
    let stop = false;
    for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { stop = true; });
    console.log(cfg.sendEnabled ? 'MARKETING_EXPLICITLY_ENABLED' : 'CONSENT_ONLY; NO_OUTBOUND_MESSAGES');
    while (!stop) {
      // Fail closed if incoming opt-outs cannot be synchronized.
      await synchronize(rpc, cfg);
      await tick(rpc, cfg, journal);
      if (!stop) await sleep(5000);
    }
  } finally { await lock.close(); await unlink(lockPath); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('MARKETING_STOPPED: confira conexão, configuração e histórico; nenhum reenvio automático.'); process.exitCode = 1; });
}
