import { requireSupabase } from '../lib/supabase';

type PendingAcceptance = { order_ref: string; occurred_at: string; attempts: number; next_at: number; review: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventName = 'delivery-acceptance-reporting';
const running = new Set<string>();
const key = (storeId: string, userId: string) => `novaesweb:accepted-orders:${userId}:${storeId}`;
const eligible = (plan: string | null | undefined) => ['NOVAES_BUSINESS', 'NOVAES_PREMIUM', 'NOVAES_EMPRESARIAL'].includes(plan || '');
function read(storeId: string, userId: string): PendingAcceptance[] {
  const value = JSON.parse(localStorage.getItem(key(storeId, userId)) || '[]');
  if (!Array.isArray(value)) throw new Error('INVALID_PENDING_ACCEPTANCES');
  return value.filter(row => uuid.test(row?.order_ref || '') && Number.isFinite(Date.parse(row?.occurred_at)) && Number.isInteger(row?.attempts) && row.attempts >= 0 && Number.isFinite(row?.next_at) && typeof row?.review === 'boolean')
    .map(row => ({ order_ref: row.order_ref, occurred_at: row.occurred_at, attempts: row.attempts, next_at: row.next_at, review: row.review }));
}
function write(storeId: string, userId: string, rows: PendingAcceptance[]) {
  localStorage.setItem(key(storeId, userId), JSON.stringify(rows));
  window.dispatchEvent(new Event(eventName));
}
function warning() {
  window.dispatchEvent(new CustomEvent('delivery-data-error', { detail: 'O pedido foi atualizado, mas não foi possível guardar a pendência de contagem neste navegador. Solicite revisão técnica; não aceite o pedido novamente.' }));
}
export function localReportingHealth(storeId: string, userId: string) {
  try { const rows = read(storeId, userId); return { pending_count: rows.length, review_count: rows.filter(row => row.review).length }; }
  catch { return null; }
}
// Only after the real conditional UPDATE succeeds. No customer data is persisted.
// Keep the original database timestamp, including after retries and cancellation.
export function queueAcceptedOrder(storeId: string, userId: string, plan: string | null | undefined, orderRef: string, occurredAt: string) {
  if (!eligible(plan)) return;
  if (!uuid.test(storeId) || !uuid.test(userId) || !uuid.test(orderRef) || !Number.isFinite(Date.parse(occurredAt))) { warning(); return; }
  try {
    const rows = read(storeId, userId);
    if (!rows.some(row => row.order_ref === orderRef)) write(storeId, userId, [...rows, { order_ref: orderRef, occurred_at: occurredAt, attempts: 0, next_at: 0, review: false }]);
  } catch { warning(); }
}
export async function flushAcceptedOrders(storeId: string, userId: string) {
  const identity = key(storeId, userId);
  if (running.has(identity) || !uuid.test(storeId) || !uuid.test(userId)) return;
  running.add(identity);
  try {
    if (!read(storeId,userId).some(row=>!row.review && row.next_at <= Date.now())) return;
    const client = requireSupabase();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || user?.id !== userId) return;
    const [member, store] = await Promise.all([
      client.from('store_members').select('role').eq('store_id', storeId).eq('user_id', userId).eq('is_active', true).maybeSingle(),
      client.from('managed_sites').select('plan_code').eq('id', storeId).maybeSingle(),
    ]);
    if (member.error || store.error || !['owner', 'admin'].includes(member.data?.role || '') || !eligible(store.data?.plan_code)) return;
    const due = read(storeId, userId).filter(row => !row.review && row.next_at <= Date.now()).slice(0, 20);
    for (const pending of due) {
      const session = await client.auth.getSession();
      if (session.error || session.data.session?.user.id !== userId) return;
      let success = false, permanent = false;
      try {
        const { data, error } = await client.rpc('novaesweb_record_order_event', {
          p_store_id: storeId, p_order_ref: pending.order_ref,
          p_event_type: 'accepted', p_occurred_at: pending.occurred_at,
        });
        success = !error && data?.event_type === 'accepted' && /^\d{4}-(0[1-9]|1[0-2])$/.test(data?.competence || '') && (data.recorded === true || data.already_counted === true);
        permanent = error?.code === '22023' || error?.code === '42501';
      } catch { /* Preserve the same reference and timestamp. */ }
      const rows = read(storeId, userId);
      if (success) write(storeId, userId, rows.filter(row => row.order_ref !== pending.order_ref));
      else write(storeId, userId, rows.map(row => row.order_ref !== pending.order_ref ? row : {
        ...row, attempts: row.attempts + 1, review: permanent || row.attempts + 1 >= 8,
        next_at: Date.now() + Math.min(60_000 * 2 ** row.attempts, 900_000),
      }));
    }
  } catch { /* Reporting must never undo a real order. */ }
  finally { running.delete(identity); }
}
export function startOrderReportingReconciliation(storeId: string, userId: string): () => void {
  const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine) void flushAcceptedOrders(storeId, userId); };
  const timer = window.setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener(eventName, refresh);
  window.addEventListener('storage', refresh);
  refresh();
  return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); window.removeEventListener(eventName, refresh); window.removeEventListener('storage', refresh); };
}
