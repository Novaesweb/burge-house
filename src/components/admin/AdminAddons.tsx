import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CircleDollarSign, Clock3, Puzzle, RefreshCw, Send, ShieldAlert, Wrench, XCircle } from 'lucide-react';
import { useConnect } from '../../context/ConnectContext';
import {
  type CatalogAddon,
  type StoreAddonCatalog,
  getStoreAddonCatalog,
  requestStoreAddon,
} from '../../services/addonService';

const formatMoney = (value: number | null) => value === null || value === undefined
  ? 'Sob consulta'
  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const billingLabel = (value: string | null) => ({
  recurring: 'Cobrança recorrente',
  one_time: 'Cobrança única',
  usage: 'Cobrança por uso',
}[value || ''] || 'Condições definidas pelo Master');

const developmentLabel = (value: string) => ({
  ready: 'Disponível para ativação',
  planned: 'Em preparação',
  unavailable: 'Indisponível',
}[value] || 'Em análise');

const compatibilityLabel = (types: string[] | null) => {
  if (!types?.length || types.includes('*')) return 'Compatível com todos os tipos de loja';
  return `Compatível com: ${types.join(', ')}`;
};

export function AdminAddons() {
  const connection = useConnect();
  const [data, setData] = useState<StoreAddonCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const store = connection.store;
  const canManage = store?.role === 'owner' || store?.role === 'admin';

  const load = useCallback(async (showRefresh = false) => {
    if (!store || !canManage) { setLoading(false); return; }
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setData(await getStoreAddonCatalog(store.id));
    } catch (failure) {
      setData(null);
      setError(failure instanceof Error ? failure.message : 'Não foi possível carregar os adicionais.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage, store]);

  useEffect(() => { void load(); }, [load]);
  const newestRequestByAddon = useMemo(() => {
    const result = new Map<string, StoreAddonCatalog['requests'][number]>();
    data?.requests.forEach(request => { if (!result.has(request.addon_id)) result.set(request.addon_id, request); });
    return result;
  }, [data]);
  const subscriptionByAddon = useMemo(() => new Map(data?.subscriptions.map(item => [item.addon_id, item])), [data]);

  const submitRequest = async (addon: CatalogAddon) => {
    if (!store || requestingId) return;
    setRequestingId(addon.id);
    setError('');
    setNotice('');
    try {
      await requestStoreAddon(store.id, addon.id);
      setNotice(`Solicitação de ${addon.name} enviada ao Painel Master.`);
      await load(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setRequestingId(null);
    }
  };

  if (!canManage) return <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100"><ShieldAlert className="mb-3 h-7 w-7" /><h1>Acesso restrito</h1><p className="mt-2 text-sm">Somente o proprietário ou um administrador ativo pode consultar e solicitar adicionais.</p></section>;

  return <div className="space-y-6">
    <section className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-300"><Puzzle size={25}/></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-rose-300">NovaesWeb Connect</p><h1 className="mt-1">Adicionais da loja</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Solicite serviços e módulos pelo catálogo central. A aprovação do Master registra o status comercial; a configuração da função é feita somente quando solicitada.</p></div></div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>Atualizar</button>
      </div>
    </section>

    {notice && <p role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
    {error && <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

    {loading ? <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-10 text-center text-sm text-neutral-400"><RefreshCw className="mx-auto mb-3 animate-spin"/>Consultando o catálogo central…</section> : data && data.catalog.length === 0 ? <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-10 text-center"><Puzzle className="mx-auto mb-3 text-neutral-500"/><h2 className="font-bold text-white">Nenhum adicional disponível</h2><p className="mt-2 text-sm text-neutral-400">O Master ainda não liberou itens comerciais para esta loja.</p></section> : <section className="grid gap-4 xl:grid-cols-2">{data?.catalog.map(addon => {
      const request = newestRequestByAddon.get(addon.id);
      const subscription = subscriptionByAddon.get(addon.id);
      const status = request?.status;
      const pending = status === 'pending' || status === 'in_review' || status === 'awaiting_confirmation';
      const inPreparation = status === 'approved' || subscription?.status === 'active';
      const rejected = status === 'rejected';
      const isBusy = requestingId === addon.id;
      return <article key={addon.id} className="rounded-3xl border border-neutral-800 bg-neutral-900 p-5 shadow-sm"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-800 text-rose-300">{addon.icon || <Puzzle size={19}/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold text-white">{addon.name}</h2><p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">{addon.category || 'Adicional NovaesWeb'}</p></div><span className="rounded-full border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-[11px] font-semibold text-neutral-300">{developmentLabel(addon.development_status)}</span></div><p className="mt-3 min-h-10 text-sm leading-5 text-neutral-400">{addon.summary || addon.description || 'Informações comerciais serão definidas pelo Master.'}</p><div className="mt-4 grid gap-2 border-y border-neutral-800 py-3 text-xs text-neutral-300 sm:grid-cols-2"><span className="inline-flex items-center gap-1.5"><CircleDollarSign size={15} className="text-emerald-300"/>{formatMoney(addon.price)} · {billingLabel(addon.billing_type)}</span><span className="inline-flex items-center gap-1.5"><Wrench size={15} className="text-amber-300"/>Implantação: {formatMoney(addon.setup_fee)}</span><span className="sm:col-span-2 text-neutral-400">{compatibilityLabel(addon.compatible_site_types)}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3">{inPreparation ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-300"><BadgeCheck size={17}/>Em preparo</span> : rejected ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-300"><XCircle size={17}/>Solicitação não aprovada</span> : pending ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300"><Clock3 size={17}/>{status === 'in_review' ? 'Em análise pelo Master' : status === 'awaiting_confirmation' ? 'Aguardando confirmação' : 'Solicitação pendente'}</span> : <span className="text-xs text-neutral-500">Compatibilidade definida pelo Master</span>}{!pending && !inPreparation && !rejected && <button type="button" disabled={Boolean(requestingId)} onClick={() => void submitRequest(addon)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"><Send size={15}/>{isBusy ? 'Enviando…' : 'Solicitar'}</button>}</div></div></div></article>;
    })}</section>}
    <p className="text-center text-xs text-neutral-500">A aprovação comercial não instala nem libera funções automaticamente. Quando precisar de um adicional, solicite a configuração específica ao suporte NovaesWeb.</p>
  </div>;
}
