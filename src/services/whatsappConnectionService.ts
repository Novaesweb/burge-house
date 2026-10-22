import { requireSupabase } from '../lib/supabase';

export type WhatsAppConnectionState = 'not_created' | 'disconnected' | 'connecting' | 'connected' | 'number_mismatch';
export interface WhatsAppConnectionStatus {
  state: WhatsAppConnectionState;
  expectedPhone: string;
  connectedPhone?: string;
  instance: string;
}
export interface WhatsAppPairing extends WhatsAppConnectionStatus { qr?: string; pairingCode?: string; }

export class WhatsAppConnectionError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'WhatsAppConnectionError'; }
}

const messages: Record<string, string> = {
  CONFIRM_SWITCH_REQUIRED: 'Confirme a troca para desconectar o WhatsApp anterior desta loja.',
  INVALID_PHONE: 'Salve um número de WhatsApp válido nas configurações da loja antes de conectar.',
  PHONE_REQUIRED: 'Salve o WhatsApp de atendimento da loja antes de conectar.',
  SERVICE_UNAVAILABLE: 'O serviço de conexão está indisponível. Tente novamente mais tarde.',
  INSTANCE_CONFLICT: 'A conexão desta loja precisa ser conferida pelo responsável pelo sistema.',
  CONNECTION_BUSY: 'Já existe uma conexão em andamento. Aguarde alguns segundos.',
  AUTH_REQUIRED: 'Sua sessão expirou. Entre novamente para conectar o WhatsApp.',
  ACCESS_DENIED: 'Sua conta não tem permissão para gerenciar o WhatsApp desta loja.',
  STORE_UNAVAILABLE: 'A loja não está disponível para esta operação. Confira o acesso com o Master.',
  PHONE_IN_USE: 'Esse WhatsApp já está vinculado a outra loja. Use um número exclusivo para esta loja.',
  BUSY: 'Já existe uma conexão em andamento. Aguarde alguns segundos.',
  RATE_LIMIT: 'Aguarde um pouco antes de tentar conectar novamente.',
  EVOLUTION_UNAVAILABLE: 'Não foi possível falar com o serviço de WhatsApp. Tente novamente mais tarde.',
};
const statusMessages: Record<number, string> = {
  401: 'Sua sessão expirou. Entre novamente para conectar o WhatsApp.',
  403: 'Sua conta não tem permissão para gerenciar o WhatsApp desta loja.',
  404: 'O serviço de conexão ainda não está disponível neste endereço.',
  409: 'A conexão mudou. Confira a situação atual antes de tentar novamente.',
  429: 'Aguarde um pouco antes de tentar conectar novamente.',
};
const states: WhatsAppConnectionState[] = ['not_created', 'disconnected', 'connecting', 'connected', 'number_mismatch'];

// Do not render arbitrary provider messages, image URLs or raw responses in the browser.
export function parseWhatsAppStatus(value: unknown): WhatsAppPairing {
  const data = value as Partial<WhatsAppPairing> | null;
  if (!data || !states.includes(data.state as WhatsAppConnectionState) || typeof data.expectedPhone !== 'string' || typeof data.instance !== 'string') {
    throw new WhatsAppConnectionError('INVALID_RESPONSE', 'O serviço retornou uma resposta inesperada. Tente novamente.');
  }
  const result: WhatsAppPairing = { state: data.state!, expectedPhone: data.expectedPhone, instance: data.instance };
  if (typeof data.connectedPhone === 'string') result.connectedPhone = data.connectedPhone;
  if (typeof data.qr === 'string' && data.qr.length <= 1_000_000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.qr)) result.qr = data.qr;
  if (typeof data.pairingCode === 'string' && /^[A-Za-z0-9 -]{4,32}$/.test(data.pairingCode)) result.pairingCode = data.pairingCode;
  return result;
}

async function request(storeId: string, connect: boolean, confirmSwitch: boolean, signal?: AbortSignal): Promise<WhatsAppPairing> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)) {
    throw new WhatsAppConnectionError('INVALID_STORE', 'A loja oficial ainda não foi validada.');
  }
  const { data: { session }, error } = await requireSupabase().auth.getSession();
  if (error || !session) throw new WhatsAppConnectionError('UNAUTHENTICATED', statusMessages[401]);
  try {
    const response = await fetch(`/api/whatsapp/${encodeURIComponent(storeId)}/${connect ? 'connect' : 'status'}`, {
      method: connect ? 'POST' : 'GET',
      credentials: 'same-origin', cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(connect ? { 'Content-Type': 'application/json' } : {}) },
      ...(connect ? { body: JSON.stringify({ confirmSwitch }) } : {}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = typeof payload?.code === 'string' && Object.hasOwn(messages, payload.code) ? payload.code : 'REQUEST_FAILED';
      throw new WhatsAppConnectionError(code, messages[code] || statusMessages[response.status] || messages.SERVICE_UNAVAILABLE);
    }
    return parseWhatsAppStatus(payload);
  } catch (failure) {
    if (failure instanceof WhatsAppConnectionError || signal?.aborted) throw failure;
    throw new WhatsAppConnectionError('SERVICE_UNAVAILABLE', messages.SERVICE_UNAVAILABLE);
  }
}

export const getWhatsAppConnectionStatus = (storeId: string, signal?: AbortSignal) => request(storeId, false, false, signal);
export const connectWhatsApp = (storeId: string, confirmSwitch = false, signal?: AbortSignal) => request(storeId, true, confirmSwitch, signal);
