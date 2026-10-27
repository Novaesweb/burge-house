import { requireSupabase } from '../lib/supabase';

export type AddonDevelopmentStatus = 'planned' | 'ready' | 'unavailable' | string;
export type AddonRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | string;
export type AddonSubscriptionStatus = 'active' | 'suspended' | 'disabled' | string;

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
  activation_location: string | null;
  suggested_route: string | null;
  integration_requirements: string | null;
  activation_rules: string | null;
  disable_rules: string | null;
  created_at: string;
}

export interface AddonRequest {
  id: string;
  addon_id: string;
  status: AddonRequestStatus;
  created_at: string;
  decision_reason: string | null;
}

export interface StoreAddon {
  addon_id: string;
  status: AddonSubscriptionStatus;
}

export interface AddonInstallation { addon_id: string; technical_status: string; installed_version: string | null; }

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

async function requireStoreManager(storeId: string) {
  assertOfficialStoreId(storeId);
  const { client, user } = await requireAuthenticatedUser();
  const [member, store] = await Promise.all([
    client.from('store_members').select('role').eq('store_id',storeId).eq('user_id',user.id).eq('is_active',true).maybeSingle(),
    client.from('managed_sites').select('id,site_type,status').eq('id',storeId).maybeSingle(),
  ]);
  if (member.error || store.error || store.data?.id !== storeId || store.data.status !== 'active' || !['owner','admin'].includes(member.data?.role || '')) throw new Error('Somente proprietário ou administrador ativo desta loja pode consultar e solicitar adicionais.');
  return { client, user, store:store.data };
}

/**
 * Reads only the current store's commercial catalog and request history.
 * The subscription data is shown as a commercial status only; it never
 * enables a feature in this delivery. RLS remains the authorization boundary.
 */
export async function getStoreAddonCatalog(storeId: string): Promise<StoreAddonCatalog> {
  const { client, store } = await requireStoreManager(storeId);

  const [catalogResult, requestResult, subscriptionResult, installationResult] = await Promise.all([
    client
      .from('addon_catalog')
      .select('id,code,name,summary,description,icon,category,billing_type,price,setup_fee,development_status,compatible_site_types,activation_location,suggested_route,integration_requirements,activation_rules,disable_rules,created_at')
      .eq('is_visible', true)
      .eq('is_active', true)
      .neq('development_status', 'unavailable')
      .order('sort_order', { ascending: true }),
    client
      .from('addon_requests')
      .select('id,addon_id,status,created_at,decision_reason')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false }),
    client
      .from('store_addons')
      .select('addon_id,status')
      .eq('store_id', storeId),
    client.from('store_addon_installations').select('addon_id,technical_status,installed_version').eq('store_id',storeId),
  ]);

  const failure = [catalogResult, requestResult, subscriptionResult, installationResult].find(result => result.error)?.error;
  if (failure) throw new Error('Não foi possível carregar os adicionais liberados pelo Master.');

  const catalog = (catalogResult.data || []) as CatalogAddon[];
  const compatibleCatalog = catalog.filter(addon => addon.compatible_site_types?.includes('*') || (store.site_type && addon.compatible_site_types?.includes(store.site_type)));

  return {
    catalog: compatibleCatalog,
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
  const { client, user } = await requireStoreManager(storeId);
  const snapshot = await getStoreAddonCatalog(storeId);
  if (!snapshot.catalog.some(addon=>addon.id===addonId)) throw new Error('Este adicional não está disponível ou não é compatível com a loja.');
  if (snapshot.requests.some(request=>request.addon_id===addonId && ['pending','in_review','awaiting_confirmation','approved','activated'].includes(request.status)) || snapshot.subscriptions.some(subscription=>subscription.addon_id===addonId)) throw new Error('Este adicional já possui solicitação ou contratação. Atualize a página para acompanhar.');
  const { error } = await client.from('addon_requests').insert({
    store_id: storeId,
    addon_id: addonId,
    requested_by: user.id,
  });
  if (error) throw new Error('Não foi possível enviar a solicitação. Confira seu vínculo com a loja e tente novamente.');
}
