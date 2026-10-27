import React, { useEffect, useState } from 'react';
import { AlertTriangle, Layers, RefreshCw, ShieldCheck } from 'lucide-react';
import { useConnect } from '../../context/ConnectContext';
import { loadPlanUsage, planName, planUsageMetrics, type PlanUsage } from '../../services/planUsageService';
import { localReportingHealth } from '../../services/orderReportingService';

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const periodLabel = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(`${value}T12:00:00Z`)) : 'Nenhuma competência registrada';
const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informado';

export function PlanUsageSummary({ data }: { data: PlanUsage }) {
  const metrics = planUsageMetrics(data);
  const start = data.plan_code === 'NOVAES_START';
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-lg font-bold text-white">{planName(data.plan_code)}</h3><p className="text-sm text-neutral-400">{data.store_name} · {data.nx_id}</p><p className="mt-1 text-sm text-neutral-300">Competência: {periodLabel(data.competence)} · Brasília</p></div>
      <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">Consulta do plano</span>
    </header>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-neutral-400">Início do plano</dt><dd>{dateLabel(data.plan_started_at)}</dd></div>
      <div><dt className="text-neutral-400">Vencimento</dt><dd>{dateLabel(data.plan_expires_at)}</dd></div>
    </dl>
    {start ? <p className="rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-300">O plano Novaes Start não inclui franquia de pedidos de delivery. Consulte o Master sobre seu contrato.</p> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([['Franquia mensal', data.franchise_orders === null ? 'A confirmar' : data.franchise_orders], ['Pedidos aceitos', data.accepted_count], ['Saldo da franquia', metrics.remaining ?? 'Não informado'], ['Pedidos excedentes', metrics.overage ?? 'Não informado']] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3"><p className="text-xs text-neutral-400">{label}</p><p className="mt-2 break-words text-xl font-bold text-white">{value}</p></div>)}
      </div>
      {metrics.percentage !== null ? <div>
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>Consumo da franquia</span><strong>{metrics.percentage}%</strong></div>
        <div role="progressbar" aria-label="Consumo da franquia mensal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.progress!} aria-valuetext={`${metrics.percentage}% da franquia consumida`} className="h-3 overflow-hidden rounded-full bg-neutral-800"><div className={`h-full rounded-full ${metrics.level === 'reached' ? 'bg-amber-400' : metrics.level === 'attention' ? 'bg-yellow-400' : 'bg-violet-400'}`} style={{ width: `${metrics.progress}%` }}/></div>
      </div> : <p className="text-sm text-neutral-400">A franquia contratual ainda não foi informada pelo Master. O consumo não foi estimado.</p>}
      {metrics.level !== 'normal' && <p role="status" className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"><AlertTriangle size={18} className="shrink-0"/>{metrics.level === 'reached' ? 'A franquia foi atingida.' : 'Você consumiu pelo menos 80% da franquia.'} Novos pedidos continuam normalmente, sem bloqueio por franquia.</p>}
      <div className="flex gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm text-neutral-200"><ShieldCheck size={20} className="shrink-0 text-violet-300"/><div><strong className="text-white">Zero bloqueio por franquia</strong><p className="mt-1">Atingir a franquia nunca interrompe o recebimento de pedidos. Pedidos rejeitados ou não aceitos não consomem a franquia. Cancelar um pedido depois de aceitá-lo não reduz a contagem.</p><p className="mt-2">{data.overage_tariff === null ? 'Tarifa contratual de excedentes não informada. Nenhuma cobrança é criada nesta tela.' : `Tarifa contratual de software: ${brl(data.overage_tariff)} por pedido aceito excedente, conforme o próximo ciclo contratual. Nenhuma cobrança é criada nesta tela.`}</p></div></div>
      <details className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"><summary className="cursor-pointer font-bold text-white">Histórico diário de pedidos aceitos</summary><p className="mt-2 text-xs text-neutral-400">Somente a competência retornada pelo servidor. Nenhum dado de clientes é exibido.</p>{data.daily.length ? <div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Pedidos aceitos por dia em {periodLabel(data.competence)}</caption><thead><tr><th scope="col" className="p-2">Dia</th><th scope="col" className="p-2 text-right">Aceitos</th></tr></thead><tbody>{data.daily.map(day => <tr key={day.day} className="border-t border-neutral-800"><th scope="row" className="p-2 font-normal">{dateLabel(`${day.day}T12:00:00Z`)}</th><td className="p-2 text-right">{day.accepted_count}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-neutral-400">Nenhum aceite registrado nesta competência.</p>}</details>
    </>}
  </div>;
}

export function StoreOrderUsageWidget() {
  const { store, session } = useConnect();
  const storeId = store?.id;
  const userId = session?.user.id;
  const allowed = Boolean(storeId && userId && ['owner', 'admin'].includes(store?.role || ''));
  const identity = allowed ? `${userId}:${storeId}` : '';
  const [state, setState] = useState<{ identity: string; data: PlanUsage | null; error: string; loading: boolean }>({ identity: '', data: null, error: '', loading: false });
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<{pending_count:number;review_count:number}|null>(null);
  useEffect(() => {
    if (!storeId || !userId) return;
    const update = () => setPending(localReportingHealth(storeId,userId));
    update(); window.addEventListener('delivery-acceptance-reporting',update); window.addEventListener('storage',update);
    return () => { window.removeEventListener('delivery-acceptance-reporting',update); window.removeEventListener('storage',update); };
  }, [storeId,userId]);
  useEffect(() => {
    if (!allowed || !storeId) return;
    let active = true;
    let fetching = false;
    const refresh = async () => {
      if (!active || fetching) return;
      fetching = true;
      setState(previous => ({ identity, data: previous.identity === identity ? previous.data : null, error: '', loading: true }));
      try {
        const data = await loadPlanUsage(storeId);
        if (active) setState({ identity, data, error: '', loading: false });
      } catch (error) {
        if (active) setState({ identity, data: null, error: error instanceof Error ? error.message : 'Não foi possível consultar o consumo.', loading: false });
      } finally { fetching = false; }
    };
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const timer = window.setInterval(visibleRefresh, 60_000);
    document.addEventListener('visibilitychange', visibleRefresh);
    window.addEventListener('online', visibleRefresh);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visibleRefresh); window.removeEventListener('online', visibleRefresh); };
  }, [allowed, identity, storeId, revision]);
  const current = state.identity === identity ? state : null;
  if (!allowed) return <p role="status" className="rounded-xl border border-neutral-700 p-4 text-sm text-neutral-300">O demonstrativo está disponível para proprietário e administrador autenticados desta loja.</p>;
  return <section aria-labelledby="plan-usage-title" aria-busy={!current || current.loading} className="rounded-3xl border border-violet-500/25 bg-neutral-900 p-4 text-neutral-200 sm:p-6">
    {Boolean(current && pending?.pending_count) && <p role="status" className="mb-4 rounded-xl border border-amber-500/40 p-3 text-sm text-amber-200">Há {pending!.pending_count} aceite(s) pendente(s) neste navegador e nesta conta. {pending!.review_count ? 'Alguns precisam de revisão técnica.' : 'O reenvio é automático enquanto o painel estiver aberto.'} O consumo central pode estar incompleto. Os pedidos continuam normalmente.</p>}
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="plan-usage-title" className="flex items-center gap-2 text-xl font-bold text-white"><Layers size={22} className="text-violet-300"/>Consumo de Pedidos</h2><button type="button" disabled={!current || current.loading} onClick={() => setRevision(value => value + 1)} className="flex items-center gap-2 rounded-xl border border-neutral-700 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={16}/>Atualizar</button></header>
    {!current || (current.loading && !current.data) ? <p role="status">Consultando o plano e o consumo no servidor...</p> : current.error ? <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">{current.error}</p> : current.data ? <PlanUsageSummary data={current.data}/> : null}
    {current?.loading && current.data && <p role="status" className="mt-3 text-xs text-neutral-400">Atualizando demonstrativo...</p>}
  </section>;
}
