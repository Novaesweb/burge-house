import { requireSupabase } from '../lib/supabase';

export interface PlanUsage {
  store_id: string; nx_id: string; store_name: string; plan_code: string | null;
  competence: string | null; franchise_orders: number | null; accepted_count: number; voided_count: number;
  daily: { day: string; accepted_count: number }[]; overage_tariff: number | null; billing_active: boolean;
  plan_started_at: string | null; plan_expires_at: string | null; payment_status: string | null;
}
export class PlanUsageError extends Error {
  constructor(public code: 'INVALID_STORE' | 'UNAUTHENTICATED' | 'UNAVAILABLE' | 'INVALID_RESPONSE', message: string) { super(message); }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 200;
const optionalText = (value: unknown): value is string | null => value === null || text(value);
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function parsePlanUsage(value: unknown, storeId: string): PlanUsage {
  const row = value as Record<string, unknown> | null;
  if (!row || Array.isArray(row) || row.store_id !== storeId || !text(row.nx_id) || !row.nx_id || !text(row.store_name) ||
    !optionalText(row.plan_code) || !(row.competence === null || (date(row.competence) && row.competence.endsWith('-01'))) ||
    !(row.franchise_orders === null || (count(row.franchise_orders) && row.franchise_orders > 0)) ||
    !count(row.accepted_count) || !count(row.voided_count) || !Array.isArray(row.daily) || row.daily.length > 31 ||
    !(row.overage_tariff === null || (typeof row.overage_tariff === 'number' && Number.isFinite(row.overage_tariff) && row.overage_tariff >= 0)) ||
    typeof row.billing_active !== 'boolean' || !optionalText(row.plan_started_at) || !optionalText(row.plan_expires_at) || !optionalText(row.payment_status)) {
    throw new PlanUsageError('INVALID_RESPONSE', 'O demonstrativo retornou dados inesperados. Tente atualizar.');
  }
  const days = new Set<string>();
  const daily = row.daily.map((item: unknown) => {
    const entry = item as Record<string, unknown> | null;
    if (!entry || !date(entry.day) || !row.competence || entry.day.slice(0, 7) !== String(row.competence).slice(0, 7) || !count(entry.accepted_count) || days.has(entry.day)) {
      throw new PlanUsageError('INVALID_RESPONSE', 'O histórico diário retornou dados inesperados.');
    }
    days.add(entry.day);
    return { day: entry.day, accepted_count: entry.accepted_count };
  }).sort((a, b) => a.day.localeCompare(b.day));
  return { store_id: storeId, nx_id: row.nx_id, store_name: row.store_name, plan_code: row.plan_code,
    competence: row.competence, franchise_orders: row.franchise_orders, accepted_count: row.accepted_count,
    voided_count: row.voided_count, daily, overage_tariff: row.overage_tariff, billing_active: row.billing_active,
    plan_started_at: row.plan_started_at, plan_expires_at: row.plan_expires_at, payment_status: row.payment_status } as PlanUsage;
}
export async function loadPlanUsage(storeId: string): Promise<PlanUsage> {
  if (!uuid.test(storeId)) throw new PlanUsageError('INVALID_STORE', 'Selecione uma loja oficial para consultar o plano.');
  try {
    const client = requireSupabase();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new PlanUsageError('UNAUTHENTICATED', 'Entre novamente para consultar seu plano.');
    const [store, member] = await Promise.all([
      client.from('managed_sites').select('id,nx_id,name,plan_code,billing_active,plan_started_at,plan_expires_at,payment_status').eq('id', storeId).maybeSingle(),
      client.from('store_members').select('role').eq('store_id', storeId).eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ]);
    if (store.error || member.error || store.data?.id !== storeId || !['owner', 'admin'].includes(member.data?.role || '')) throw new Error('ACCESS_DENIED');
    const plan = store.data.plan_code;
    const start = plan === 'NOVAES_START';
    const franchise = plan === 'NOVAES_BUSINESS' ? 340 : plan === 'NOVAES_PREMIUM' ? 750 : null;
    // PostgreSQL resolves the special timestamptz input "now" on the server;
    // the existing helper computes Brasília competence, without a browser clock.
    const period = start ? {data:null,error:null} : await client.rpc('novaesweb_order_competence',{p_ts:'now'});
    if(period.error || (!start && (!date(period.data) || !period.data.endsWith('-01')))) throw new Error('COMPETENCE_UNAVAILABLE');
    const competence:string|null = period.data;
    const monthly = start ? {data:[],error:null} : await client.from('store_order_usage_monthly').select('store_id,competence,accepted_count,voided_count').eq('store_id', storeId).eq('competence',competence!).limit(1);
    if (monthly.error) throw new Error('USAGE_UNAVAILABLE');
    const latest = monthly.data?.[0];
    if (latest && (latest.store_id !== storeId || latest.competence !== competence)) throw new Error('WRONG_STORE_OR_PERIOD');
    const daily = new Map<string, number>();
    if (competence && latest) {
      const summary = await client.from('store_order_lifecycle_summary').select('store_id,competence,accepted_count').eq('store_id', storeId).eq('competence', competence.slice(0,7)).maybeSingle();
      if (summary.error || !summary.data || summary.data.store_id !== storeId || summary.data.accepted_count !== latest!.accepted_count) throw new Error('INCONSISTENT_SNAPSHOT');
      // Page through minimal, own-store technical event fields; no customer data.
      for (let offset = 0; ; offset += 1000) {
        const page = await client.from('store_order_usage_events').select('id,accepted_at').eq('store_id', storeId).eq('competence', competence).eq('is_voided', false).order('id').range(offset, offset + 999);
        if (page.error) throw new Error('DAILY_UNAVAILABLE');
        for (const row of page.data || []) {
          if (!Number.isFinite(Date.parse(row.accepted_at))) throw new Error('INVALID_ACCEPTANCE_DATE');
          const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(row.accepted_at));
          const part = (type:string) => parts.find(p=>p.type===type)!.value;
          const day = `${part('year')}-${part('month')}-${part('day')}`;
          daily.set(day, (daily.get(day) || 0) + 1);
        }
        if ((page.data?.length || 0) < 1000) break;
      }
      if ([...daily.values()].reduce((sum,n)=>sum+n,0) !== latest!.accepted_count) throw new Error('INCONSISTENT_SNAPSHOT');
    }
    return parsePlanUsage({ store_id:storeId,nx_id:store.data.nx_id,store_name:store.data.name,plan_code:plan,
      competence,franchise_orders:franchise,accepted_count:latest?.accepted_count??0,voided_count:latest?.voided_count??0,
      daily:[...daily].map(([day,accepted_count])=>({day,accepted_count})),overage_tariff:null,
      billing_active:store.data.billing_active,plan_started_at:store.data.plan_started_at,
      plan_expires_at:store.data.plan_expires_at,payment_status:store.data.payment_status },storeId);
  } catch (error) {
    if (error instanceof PlanUsageError) throw error;
    throw new PlanUsageError('UNAVAILABLE', 'Não foi possível confirmar o consumo. Atualize novamente e confira sua conexão e seu vínculo com a loja.');
  }
}
export function planUsageMetrics(data: PlanUsage) {
  const limit = data.franchise_orders;
  const percentage = limit === null ? null : Math.round(data.accepted_count / limit * 100);
  const overage = limit === null ? null : Math.max(0, data.accepted_count - limit);
  return { percentage, progress: percentage === null ? null : Math.min(100, percentage),
    remaining: limit === null ? null : Math.max(0, limit - data.accepted_count), overage,
    level: limit !== null && data.accepted_count >= limit ? 'reached' : limit !== null && data.accepted_count >= limit * 0.8 ? 'attention' : 'normal' } as const;
}
export function planName(code: string | null) {
  return ({ NOVAES_START: 'Novaes Start', NOVAES_BUSINESS: 'Novaes Business', NOVAES_PREMIUM: 'Novaes Premium', NOVAES_EMPRESARIAL: 'Novaes Empresarial' } as Record<string, string>)[code || ''] || code || 'Plano não informado';
}
export function settingsSectionFromUrl(href: string): 'geral' | 'plano' { return new URL(href).searchParams.get('secao') === 'plano' ? 'plano' : 'geral'; }
export function settingsSectionUrl(href: string, section: 'geral' | 'plano') { const url = new URL(href); if (section === 'plano') url.searchParams.set('secao', 'plano'); else url.searchParams.delete('secao'); return url.href; }
