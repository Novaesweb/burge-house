import { requireSupabase } from '../lib/supabase';

export interface RegistrationStatus {
  request_id: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  store_id?: string;
  nx_id?: string;
  site_name?: string;
  review_note?: string;
}
export interface OfficialStore { id: string; nx_id: string; name: string; status: string; site_type: string | null; plan_code?:string|null; role: 'owner' | 'admin' | 'staff' | 'viewer'; }
export interface RegistrationInput { site_name: string; site_domain?: string; owner_name?: string; plan_code?: string; }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CheckInBlock { status: string; blockMode: string | null; message: string | null; returnAt: string | null; }
export class CentralActionError extends Error {
  constructor(message: string, public httpStatus: number, public block: CheckInBlock | null = null) { super(message); this.name = 'CentralActionError'; }
}

export async function centralAction<T>(body: Record<string, unknown>): Promise<T> {
  const client = requireSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Entre na sua conta para continuar.');
  const { data, error } = await client.functions.invoke('novaesweb-admin', {
    body, headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let message = 'Não foi possível falar com o Master. Tente novamente.';
    const response = error.context;
    if (response instanceof Response) {
      const payload = await response.clone().json().catch(() => null);
      message = typeof payload?.error === 'string' ? payload.error : ({401:'Sua sessão expirou. Entre novamente.',403:'Sua conta não tem permissão para esta operação.',404:'Cadastro não encontrado.',429:'Limite de solicitações atingido. Tente mais tarde.'} as Record<number,string>)[response.status] || message;
      const block = response.status === 403 && typeof payload?.status === 'string' ? {
        status: payload.status,
        blockMode: typeof payload.block_mode === 'string' ? payload.block_mode : null,
        message: typeof payload.block_message === 'string' ? payload.block_message : message,
        returnAt: typeof payload.status_until === 'string' ? payload.status_until : typeof payload.block_until === 'string' ? payload.block_until : null,
      } : null;
      throw new CentralActionError(message, response.status, block);
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function normalizeSiteDomain(value?: string): string | null {
  const rawValue = value?.trim() || '';
  if (!rawValue) return null;
  const url = new URL(rawValue.includes('://') ? rawValue : `https://${rawValue}`);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !hostname.includes('.') || hostname === 'localhost' || /^[\d.]+$/.test(hostname) || hostname.includes(':')) {
    throw new Error('Informe um domínio público válido ou deixe este campo vazio.');
  }
  return hostname;
}

export async function requestRegistration(input: RegistrationInput): Promise<RegistrationStatus> {
  const client = requireSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Entre novamente para confirmar sua identidade.');
  if (!user.email_confirmed_at && !user.phone_confirmed_at) throw new Error('Confirme seu e-mail antes de solicitar o cadastro.');
  const normalized = { site_name: input.site_name.trim(), site_domain: normalizeSiteDomain(input.site_domain), owner_name: input.owner_name?.trim() || null, plan_code: input.plan_code?.trim() || null };
  if (!normalized.site_name || normalized.site_name.length > 160) throw new Error('Informe o nome da loja (até 160 caracteres).');
  const storageKey = `novaesweb:registration-attempt:${user.id}:${normalized.site_domain || 'sem-dominio'}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  const signature = JSON.stringify(normalized);
  const idempotencyKey = saved?.signature === signature && uuid.test(saved?.key || '') ? saved.key : crypto.randomUUID();
  // Persist before sending: a network retry must reuse exactly the same attempt.
  localStorage.setItem(storageKey, JSON.stringify({ signature, key: idempotencyKey }));
  const result = await centralAction<RegistrationStatus>({ action: 'request_site_registration', ...normalized, idempotency_key: idempotencyKey });
  if (!uuid.test(result.request_id) || result.status !== 'pending_approval') throw new Error('Resposta inesperada do cadastro oficial.');
  localStorage.setItem(`novaesweb:request:${user.id}`, result.request_id);
  return result;
}

export async function getRegistrationStatus(requestId: string): Promise<RegistrationStatus> {
  if (!uuid.test(requestId)) throw new Error('Solicitação inválida.');
  const result = await centralAction<RegistrationStatus>({ action: 'get_site_registration_status', request_id: requestId });
  if (!['pending_approval','approved','rejected'].includes(result.status) || result.request_id !== requestId) throw new Error('Resposta inesperada do Master.');
  return result;
}

export async function validateOfficialStore(storeId: string, nxId: string): Promise<OfficialStore> {
  if (!uuid.test(storeId) || !nxId) throw new Error('O Master ainda não forneceu os identificadores oficiais.');
  const client = requireSupabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sua sessão expirou. Entre novamente.');
  const { data: store, error: storeError } = await client.from('managed_sites').select('id,nx_id,name,status,site_type,plan_code').eq('id', storeId).eq('nx_id', nxId).maybeSingle();
  if (storeError) throw new Error('Não foi possível validar a loja oficial.');
  if (!store) throw new Error('Loja não encontrada ou sem acesso autorizado.');
  const { data: member, error: memberError } = await client.from('store_members').select('role').eq('store_id', store.id).eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (memberError || !member) throw new Error('Sua conta não tem vínculo ativo com esta loja.');
  if (!['owner','admin','staff','viewer'].includes(member.role)) throw new Error('Seu vínculo não permite acessar este painel.');
  return { ...store, role: member.role };
}

export async function checkIn(store: OfficialStore): Promise<void> {
  const result = await centralAction<{store_id:string;nx_id:string;integration_status:string}>({ action:'site_checkin', nx_id:store.nx_id });
  if (result.store_id !== store.id || result.nx_id !== store.nx_id || result.integration_status !== 'connected') throw new Error('O Master não confirmou a conexão desta loja.');
}
