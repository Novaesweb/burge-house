import { requireSupabase } from '../lib/supabase';

export type AddonDevelopmentStatus = 'planned' | 'ready' | 'unavailable' | string;
export type AddonRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | string;
export type AddonSubscriptionStatus = 'active' | 'suspended' | 'disabled' | string;
export type AddonTechnicalStatus = 'available' | 'degraded' | 'unavailable' | string;

export interface CatalogAddon {
  id: string;
  code: string;
  name: string;
  summary: string | null;
  description: string | null;
  icon: string | null;
  category: string | null;
  billing_type: string | null;
  price: number | null;
  setup_fee: number | null;
  development_status: AddonDevelopmentStatus;
  compatible_site_types: string[] | null;
}

export interface AddonRequest {
  id: string;
  addon_id: string;
  status: AddonRequestStatus;
  created_at: string;
}

export interface StoreAddon {
  addon_id: string;
  status: AddonSubscriptionStatus;
}

export interface AddonInstallation {
  addon_id: string;
  technical_status: AddonTechnicalStatus;
}

export interface StoreAddonCatalog {
  catalog: CatalogAddon[];
  requests: AddonRequest[];
  subscriptions: StoreAddon[];
  installations: AddonInstallation[];
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertOfficialStoreId(storeId: string) {
  if (!uuid.test(storeId)) throw new Error('A loja oficial não foi identificada.');
}

async function requireAuthenticatedUser() {
  const client = requireSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Entre novamente para continuar.');
  return { client, user };
}

/**
 * Reads only the current store's commercial catalog and its own entitlement
 * state. RLS remains the authorization boundary for every query.
 */
export async function getStoreAddonCatalog(storeId: string): Promise<StoreAddonCatalog> {
  assertOfficialStoreId(storeId);
  const { client } = await requireAuthenticatedUser();

  const [catalogResult, requestResult, subscriptionResult, installationResult] = await Promise.all([
    client
      .from('addon_catalog')
      .select('id,code,name,summary,description,icon,category,billing_type,price,setup_fee,development_status,compatible_site_types')
      .eq('is_visible', true)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    client
      .from('addon_requests')
      .select('id,addon_id,status,created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false }),
    client
      .from('store_addons')
      .select('addon_id,status')
      .eq('store_id', storeId),
    client
      .from('store_addon_installations')
      .select('addon_id,technical_status')
      .eq('store_id', storeId),
  ]);

  const failure = [catalogResult, requestResult, subscriptionResult, installationResult].find(result => result.error)?.error;
  if (failure) throw new Error('Não foi possível carregar os adicionais liberados pelo Master.');

  return {
    catalog: (catalogResult.data || []) as CatalogAddon[],
    requests: (requestResult.data || []) as AddonRequest[],
    subscriptions: (subscriptionResult.data || []) as StoreAddon[],
    installations: (installationResult.data || []) as AddonInstallation[],
  };
}

/**
 * A store can create only its own commercial request. It never writes an
 * entitlement, price, approval or technical installation record.
 */
export async function requestStoreAddon(storeId: string, addonId: string): Promise<void> {
  assertOfficialStoreId(storeId);
  if (!uuid.test(addonId)) throw new Error('Adicional inválido.');
  const { client, user } = await requireAuthenticatedUser();
  const { error } = await client.from('addon_requests').insert({
    store_id: storeId,
    addon_id: addonId,
    requested_by: user.id,
  });
  if (error) throw new Error('Não foi possível enviar a solicitação. Confira seu vínculo com a loja e tente novamente.');
}

export function isAddonTechnicallyAvailable(
  addon: CatalogAddon,
  subscription?: StoreAddon,
  installation?: AddonInstallation,
): boolean {
  return addon.development_status === 'ready'
    && subscription?.status === 'active'
    && installation?.technical_status === 'available';
}
