const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export function instanceName(storeId) {
  if (!uuid.test(storeId || '')) throw new Error('INVALID_STORE');
  return 'nw_' + storeId.toLowerCase().replaceAll('-', '');
}

export function normalizePhone(value) {
  let number = String(value ?? '').replace(/\D/g, '');
  if (/^\d{10,11}$/.test(number)) number = '55' + number;
  if (!/^55\d{10,11}$/.test(number)) throw new Error('INVALID_PHONE');
  return number;
}

export async function loadStoreContact(env, storeId, request = fetch) {
  instanceName(storeId);
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL || '') || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('MISSING_SERVER_CONFIG');
  }
  try {
    const response = await request(`${env.SUPABASE_URL}/rest/v1/delivery_settings?select=payload&store_id=eq.${storeId}`, {
      redirect: 'error', signal: AbortSignal.timeout(10000), headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
    });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error();
    const payload = rows[0]?.payload;
    const phone = normalizePhone(payload?.phone);
    if (typeof payload?.name !== 'string' || !payload.name.trim() || payload.name.length > 150 || /[\r\n\x00-\x1f]/.test(payload.name)) throw new Error();
    return { phone, name: payload.name.trim() };
  } catch { throw new Error('STORE_CONTACT_UNAVAILABLE'); }
}

export async function verifyStoreSender(env, cfg, request = fetch) {
  const instance = instanceName(cfg.store);
  const contact = await loadStoreContact(env, cfg.store, request);
  let rows;
  try {
    const response = await request(`${cfg.url}/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`, {
      redirect: 'error', signal: AbortSignal.timeout(10000), headers: { apikey: cfg.key },
    });
    if (!response.ok) throw new Error();
    rows = await response.json();
  } catch { throw new Error('SENDER_UNAVAILABLE'); }
  // Provider responses can include credentials. Never return or log raw rows.
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.name !== instance) throw new Error('SENDER_BINDING_MISMATCH');
  if (rows[0].connectionStatus !== 'open') throw new Error('SENDER_NOT_CONNECTED');
  let senderPhone;
  try {
    const match = /^(55\d{10,11})(?::\d+)?@s\.whatsapp\.net$/.exec(rows[0].ownerJid || '');
    if (!match) throw new Error();
    senderPhone = normalizePhone(match[1]);
  } catch { throw new Error('SENDER_BINDING_MISMATCH'); }
  if (senderPhone !== contact.phone) throw new Error('SENDER_BINDING_MISMATCH');
  return { ...cfg, instance, storeName: contact.name, senderPhone };
}
