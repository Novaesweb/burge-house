import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, CircleAlert, CircleDollarSign, Clock3, Puzzle, RefreshCw, Send, ShieldAlert, Sparkles, Wrench, XCircle } from 'lucide-react';
import { useConnect } from '../../context/ConnectContext';
import { supabase } from '../../lib/supabase';
import { type AddonRequest, type CatalogAddon, type StoreAddonCatalog, getStoreAddonCatalog, requestStoreAddon } from '../../services/addonService';

import { commercialState, isNewAddon, type CommercialGroup, type CommercialState } from '../../utils/addonCommercialState';

const formatMoney = (value: number | null) => value === null || value === undefined ? 'Sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const billingLabel = (value: string | null) => ({ monthly: 'Cobrança recorrente', one_time: 'Cobrança única', per_use: 'Cobrança por uso', quote: 'Sob consulta', free: 'Sem cobrança' }[value || ''] || 'Condições definidas pelo Master');
const developmentLabel = (value: string) => ({ ready: 'Disponível para ativação', planned: 'Planejado no catálogo', in_development: 'Em desenvolvimento', unavailable: 'Indisponível' }[value] || 'Em análise');
const compatibilityLabel = (types: string[] | null) => !types?.length || types.includes('*') ? 'Compatível com todos os tipos de loja' : `Compatível com: ${types.join(', ')}`;
const activationLocationLabel = (value: string | null) => ({ client_panel: 'Painel da loja', public_site: 'Site público', both: 'Painel e site público', external: 'Serviço externo' }[value || ''] || 'Definido pelo Master');
type CatalogItem = { addon: CatalogAddon; state: CommercialState; reason?:string|null };

function CommercialBadge({ state }: { state: CommercialState }) {
  const style = { active: 'text-emerald-300', pending: 'text-amber-300', preparing: 'text-sky-300', rejected: 'text-rose-300', review: 'text-neutral-400', disabled: 'text-neutral-500' }[state.tone];
  const Icon = state.tone === 'active' || state.tone === 'preparing' ? BadgeCheck : state.tone === 'rejected' || state.tone === 'disabled' ? XCircle : state.tone === 'review' ? CircleAlert : Clock3;
  return <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${style}`}><Icon size={17}/>{state.label}</span>;
}

function AddonCard({ item, requesting, onRequest }: { item: CatalogItem; requesting: boolean; onRequest: (addon: CatalogAddon) => void }) {
  const { addon, state } = item;
  return <article className="rounded-3xl border border-neutral-800 bg-neutral-900 p-5 shadow-sm">
    <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-800 text-rose-300">{addon.icon || <Puzzle size={19}/>}</span><div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-white">{addon.name}</h2>{isNewAddon(addon.created_at) && <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200"><Sparkles size={11}/>Novo</span>}</div><p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">{addon.category || 'Adicional NovaesWeb'}</p></div><span className="rounded-full border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-[11px] font-semibold text-neutral-300">{developmentLabel(addon.development_status)}</span></div>
      <p className="mt-3 min-h-10 text-sm leading-5 text-neutral-400">{addon.summary || addon.description || 'Informações comerciais serão definidas pelo Master.'}</p>
      {item.reason && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-amber-200">Situação informada pelo Master: {item.reason}</p>}
      <div className="mt-4 grid gap-2 border-y border-neutral-800 py-3 text-xs text-neutral-300 sm:grid-cols-2"><span className="inline-flex items-center gap-1.5"><CircleDollarSign size={15} className="text-emerald-300"/>{formatMoney(addon.price)} · {billingLabel(addon.billing_type)}</span><span className="inline-flex items-center gap-1.5"><Wrench size={15} className="text-amber-300"/>Implantação: {formatMoney(addon.setup_fee)}</span><span className="sm:col-span-2 text-neutral-400">{compatibilityLabel(addon.compatible_site_types)}</span></div>
      <details className="group mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3 text-xs leading-5 text-neutral-400"><summary className="cursor-pointer list-none font-bold text-neutral-200"><span className="inline-flex items-center gap-2"><CircleAlert size={15} className="text-rose-300"/><span className="group-open:hidden">Ver como funciona e os requisitos</span><span className="hidden group-open:inline">Ocultar detalhes</span></span></summary><div className="mt-3 space-y-3 border-t border-neutral-800 pt-3"><p><strong className="text-neutral-100">O que este adicional oferece:</strong> {addon.description || addon.summary || 'O Master definirá a descrição deste serviço.'}</p>{addon.suggested_route && <p><strong className="text-neutral-100">Local sugerido:</strong> {addon.suggested_route}</p>}<p><strong className="text-neutral-100">Onde será usado:</strong> {activationLocationLabel(addon.activation_location)}</p>{addon.integration_requirements && <p><strong className="text-neutral-100">O que será necessário:</strong> {addon.integration_requirements}</p>}{addon.activation_rules && <p><strong className="text-neutral-100">Para ativar:</strong> {addon.activation_rules}</p>}{addon.disable_rules && <p><strong className="text-neutral-100">Quando pode ser desativado:</strong> {addon.disable_rules}</p>}<p className="rounded-xl bg-neutral-900 p-2 text-neutral-300">A solicitação passa pelo Master. A aprovação comercial não instala o recurso: a configuração é feita em uma etapa específica.</p></div></details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><CommercialBadge state={state}/>{state.canRequest && <button type="button" disabled={requesting} onClick={() => onRequest(addon)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"><Send size={15}/>{requesting ? 'Enviando…' : 'Solicitar'}</button>}</div>
    </div></div>
  </article>;
}

export function AdminAddons() {
  const connection = useConnect();
  const [data, setData] = useState<StoreAddonCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | CommercialGroup>('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const store = connection.store;
  const storeId = store?.id;
  const userId = connection.session?.user.id;
  const identity = `${userId || ''}:${storeId || ''}`;
  const [loadedIdentity,setLoadedIdentity] = useState('');
  const generation = useRef(0);
  const fetching = useRef(false);
  const queuedRefresh = useRef(false);
  const canManage = Boolean(connection.session && store?.status === 'active' && (store?.role === 'owner' || store?.role === 'admin'));

  const load = useCallback(async (showRefresh = false) => {
    if (!storeId || !canManage) { setLoading(false); return; }
    if (fetching.current) { queuedRefresh.current = true; return; }
    fetching.current = true;
    const version = generation.current;
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try { const result = await getStoreAddonCatalog(storeId); if(version === generation.current){setData(result);setLoadedIdentity(identity);} }
    catch (failure) { if(version === generation.current){setData(null);setError(failure instanceof Error ? failure.message : 'Não foi possível carregar os adicionais.');} }
    finally { if(version === generation.current){fetching.current=false;setLoading(false);setRefreshing(false);if(queuedRefresh.current){queuedRefresh.current=false;setReload(value=>value+1);}} }
  }, [canManage, storeId, identity]);
  const [reload,setReload] = useState(0);

  useEffect(() => { ++generation.current; fetching.current=false;queuedRefresh.current=false;setData(null);setNotice('');setError('');void load();return()=>{++generation.current;}; }, [load]);
  useEffect(() => { if(reload)void load(true); },[reload,load]);
  useEffect(() => {
    const client = supabase;
    if (!client || !store || !canManage) return;
    const refresh = () => { void load(true); };
    const channel = client.channel(`novaesweb-catalog:${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_catalog' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_requests', filter: `store_id=eq.${store.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_addons', filter: `store_id=eq.${store.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_addon_installations', filter: `store_id=eq.${store.id}` }, refresh)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = window.setInterval(onVisible, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); void client.removeChannel(channel); };
  }, [canManage, load, storeId]);

  const currentData = loadedIdentity === identity && canManage ? data : null;

  const newestRequestByAddon = useMemo(() => {
    const result = new Map<string, AddonRequest>();
    currentData?.requests.forEach(request => { if (!result.has(request.addon_id)) result.set(request.addon_id, request); });
    return result;
  }, [currentData]);
  const subscriptionByAddon = useMemo(() => new Map(currentData?.subscriptions.map(item => [item.addon_id, item])), [currentData]);
  const installationByAddon = useMemo(() => new Map(currentData?.installations.map(item => [item.addon_id,item])),[currentData]);
  const catalogItems = useMemo(() => (currentData?.catalog || []).map(addon => ({ addon, reason:newestRequestByAddon.get(addon.id)?.decision_reason,state: commercialState(newestRequestByAddon.get(addon.id), subscriptionByAddon.get(addon.id),addon,installationByAddon.get(addon.id)) })), [currentData, newestRequestByAddon, subscriptionByAddon,installationByAddon]);
  const statusFilters = useMemo(() => [
    { id: 'all' as const, label: 'Todos', count: catalogItems.length },
    { id: 'available' as const, label: 'Disponíveis', count: catalogItems.filter(item => item.state.group === 'available').length },
    { id: 'requested' as const, label: 'Solicitados', count: catalogItems.filter(item => item.state.group === 'requested').length },
    { id: 'preparing' as const, label: 'Em preparo', count: catalogItems.filter(item => item.state.group === 'preparing').length },
    { id: 'active' as const, label: 'Ativos', count: catalogItems.filter(item => item.state.group === 'active').length },
    { id: 'disabled' as const, label: 'Desativados', count: catalogItems.filter(item => item.state.group === 'disabled').length },
  ], [catalogItems]);
  const visibleItems = statusFilter === 'all' ? catalogItems : catalogItems.filter(item => item.state.group === statusFilter);

  const submitRequest = async (addon: CatalogAddon) => {
    if (!store || !canManage || requestingId || loadedIdentity!==identity) return;
    const version=generation.current;
    setRequestingId(addon.id); setError(''); setNotice('');
    try { await requestStoreAddon(store.id, addon.id); if(version===generation.current){setNotice(`Solicitação de ${addon.name} enviada ao Painel Master.`);await load(true);} }
    catch (failure) { if(version===generation.current)setError(failure instanceof Error ? failure.message : 'Não foi possível enviar a solicitação.'); }
    finally { if(version===generation.current)setRequestingId(null); }
  };

  if (!canManage) return <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100"><ShieldAlert className="mb-3 h-7 w-7" /><h1>Acesso restrito</h1><p className="mt-2 text-sm">Somente o proprietário ou um administrador ativo pode consultar e solicitar adicionais.</p></section>;

  return <div className="space-y-6">
    <section className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-300"><Puzzle size={25}/></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-rose-300">NovaesWeb Connect</p><h1 className="mt-1">Adicionais da loja</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Acompanhe cada adicional por situação comercial. A aprovação do Master não instala uma função automaticamente.</p></div></div><button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>Atualizar</button></div></section>
    {refreshing && <p role="status" className="flex items-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100"><RefreshCw size={16} className="animate-spin"/>Buscando novos adicionais e atualizações no banco de dados…</p>}
    {notice && <p role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
    {error && <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
    {loading ? <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-10 text-center text-sm text-neutral-400"><RefreshCw className="mx-auto mb-3 animate-spin"/>Consultando o catálogo central…</section> : data && data.catalog.length === 0 ? <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-10 text-center"><Puzzle className="mx-auto mb-3 text-neutral-500"/><h2 className="font-bold text-white">Nenhum adicional disponível</h2><p className="mt-2 text-sm text-neutral-400">O Master ainda não liberou itens comerciais compatíveis com esta loja.</p></section> : <><section className="flex flex-wrap gap-2" aria-label="Filtrar adicionais por situação">{statusFilters.map(filter => <button key={filter.id} type="button" onClick={() => setStatusFilter(filter.id)} className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${statusFilter === filter.id ? 'border-rose-400 bg-rose-500/15 text-rose-100' : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800'}`}>{filter.label} <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-xs">{filter.count}</span></button>)}</section><section className="grid gap-4 xl:grid-cols-2">{visibleItems.map(item => <AddonCard key={item.addon.id} item={item} requesting={requestingId === item.addon.id} onRequest={addon => void submitRequest(addon)} />)}</section>{visibleItems.length === 0 && <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-10 text-center text-sm text-neutral-400">Nenhum adicional nesta situação.</section>}</>}
    <p className="text-center text-xs text-neutral-500">Solicitado aguarda análise do Master. Em preparo representa uma solicitação aprovada. Ativo depende de uma permissão concedida pelo Master.</p>
  </div>;
}
