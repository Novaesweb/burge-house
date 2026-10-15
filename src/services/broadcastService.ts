import { MasterBroadcast } from '../types';

export const MASTER_CANONICAL_SITE_ID = 'burger-house';
export const MASTER_IDENTIFIER_NX_ID = 'Burger House';

/**
 * Normalizes any broadcast shape into a canonical MasterBroadcast object.
 */
export function normalizeBroadcast(raw: any, fallbackId: string): MasterBroadcast | null {
  if (!raw) return null;

  if (typeof raw === 'string' && raw.trim()) {
    return {
      id: fallbackId,
      title: 'Comunicado do Painel Master',
      message: raw.trim(),
      status: 'active',
      priority: 'info',
      source: `Painel Master (${MASTER_IDENTIFIER_NX_ID})`,
      createdAt: new Date().toISOString(),
    };
  }

  if (typeof raw === 'object') {
    const rawStatus = String(raw.status || raw.situacao || (raw.active === true ? 'active' : '')).toLowerCase();
    const isActive = rawStatus === 'active' || rawStatus === 'ativo' || raw.active === true;

    if (!isActive) {
      return null;
    }

    const title = String(raw.title || raw.titulo || 'Comunicado Oficial do Sistema').trim();
    const message = String(raw.message || raw.mensagem || raw.texto || raw.conteudo || raw.body || '').trim();

    if (!message && !title) {
      return null;
    }

    const id = String(
      raw.id ||
      raw.broadcastId ||
      raw.comunicadoId ||
      raw.updatedAt ||
      raw.createdAt ||
      `${fallbackId}_${title.slice(0, 15)}_${message.slice(0, 20)}`
    ).trim();

    return {
      id,
      title: title || 'Comunicado do Painel Master',
      message: message || title,
      status: 'active',
      priority: String(raw.priority || raw.tipo || raw.type || 'info').toLowerCase(),
      createdAt: raw.createdAt || raw.created_at || raw.data || raw.timestamp || new Date().toISOString(),
      source: raw.source || raw.origem || `Painel Master (${MASTER_IDENTIFIER_NX_ID})`,
      author: raw.author || raw.autor || 'Central NovaesWeb / Master',
      targetNxId: raw.targetNxId || MASTER_IDENTIFIER_NX_ID,
      targetSiteId: raw.targetSiteId || MASTER_CANONICAL_SITE_ID,
      actionUrl: raw.actionUrl || raw.action_url || raw.link || raw.url,
      actionText: raw.actionText || raw.action_text || raw.botaoTexto,
    };
  }

  return null;
}

/**
 * Checks if a broadcast has already been dismissed by the store owner in localStorage.
 */
export function isBroadcastDismissed(broadcastId: string): boolean {
  if (typeof window === 'undefined' || !broadcastId) return false;
  try {
    return localStorage.getItem(`dismissed_broadcast_${broadcastId}`) === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks a broadcast as dismissed in localStorage.
 */
export function dismissBroadcast(broadcastId: string): void {
  if (typeof window === 'undefined' || !broadcastId) return;
  try {
    localStorage.setItem(`dismissed_broadcast_${broadcastId}`, 'true');
    localStorage.setItem(`dismissed_broadcast_time_${broadcastId}`, new Date().toISOString());
  } catch (err) {
    console.warn('Could not store broadcast dismissal:', err);
  }
}

/**
 * Clears dismissal flag if owner wants to re-read.
 */
export function clearBroadcastDismissal(broadcastId: string): void {
  if (typeof window === 'undefined' || !broadcastId) return;
  try {
    localStorage.removeItem(`dismissed_broadcast_${broadcastId}`);
    localStorage.removeItem(`dismissed_broadcast_time_${broadcastId}`);
  } catch {
    // ignore
  }
}

/**
 * Remote broadcasts are unavailable until the new backend is connected
 */
export function subscribeMasterBroadcast(_siteId: string = MASTER_CANONICAL_SITE_ID, onBroadcastChange: (broadcast: MasterBroadcast | null) => void): () => void {
  onBroadcastChange(null);
  return () => {};
}


