import React, { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useConnect } from '../../context/ConnectContext';
import { requireSupabase } from '../../lib/supabase';
import { useAddonEntitlements } from '../../context/AddonEntitlementsContext';

type Cost = { store_id:string; product_id:string; cost:number };
type Recurring = { id:string; store_id:string; description:string; amount:number; category:string; due_day:number; active:boolean };
type Closing = { id:string; period_start:string; period_end:string; expected_amount:number; actual_amount:number|null; closed_at:string };
const money = (n:number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const AdminFinanceExtras: React.FC = () => {
  const { hasAny } = useAddonEntitlements();
  const { siteId, products, orders, manualPayments } = useStore();
  const { store } = useConnect();
  const [costs,setCosts] = useState<Cost[]>([]);
  const [recurring,setRecurring] = useState<Recurring[]>([]);
  const [closings,setClosings] = useState<Closing[]>([]);
  const [description,setDescription] = useState('');
  const [amount,setAmount] = useState('');
  const [category,setCategory] = useState('Fixo');
  const [dueDay,setDueDay] = useState(10);
  const [actual,setActual] = useState('');
  const [notes,setNotes] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const allowed = store?.id === siteId && ['owner','admin'].includes(store.role);
  useEffect(()=>{
    if(!siteId || !allowed){setCosts([]);setRecurring([]);setClosings([]);return;}
    let mounted=true;
    const db=requireSupabase();
    Promise.all([
      db.from('delivery_product_costs').select('store_id,product_id,cost').eq('store_id',siteId),
      db.from('delivery_recurring_expenses').select('*').eq('store_id',siteId).order('due_day'),
      db.from('delivery_cash_closings').select('*').eq('store_id',siteId).order('closed_at',{ascending:false}).limit(15),
    ]).then(([a,b,c])=>{
      if(!mounted)return;
      if(a.error||b.error||c.error)setError('Não foi possível carregar os dados financeiros.');
      else {setCosts((a.data||[]) as Cost[]);setRecurring((b.data||[]) as Recurring[]);setClosings((c.data||[]) as Closing[]);}
    });
    return ()=>{mounted=false;};
  },[siteId,allowed,refresh]);
  const execute = async (action:()=>Promise<{error:any}>)=>{
    setBusy(true);setError('');
    try{const result=await action();if(result.error)throw result.error;setRefresh(n=>n+1);}
    catch{setError('Operação não concluída. Verifique os dados e sua permissão.');}
    finally{setBusy(false);}
  };
  const saveCost=(productId:string,raw:string)=>{
    const cost=Number(raw.replace(',','.'));
    if(!Number.isFinite(cost)||cost<0){setError('Custo inválido.');return;}
    void execute(async()=>await requireSupabase().from('delivery_product_costs').upsert({store_id:siteId,product_id:productId,cost},{onConflict:'store_id,product_id'}));
  };
  const addRecurring=(e:React.FormEvent)=>{
    e.preventDefault();
    const value=Number(amount.replace(',','.'));
    if(!Number.isFinite(value)||value<=0||!description.trim()||dueDay<1||dueDay>31){setError('Confira a despesa e o vencimento.');return;}
    void execute(async()=>{const result=await requireSupabase().from('delivery_recurring_expenses').insert({store_id:siteId,description:description.trim(),amount:value,category,due_day:dueDay});if(!result.error){setDescription('');setAmount('');}return result;});
  };
  const today=new Date();
  const periodStart=new Date(today.getFullYear(),today.getMonth(),today.getDate()).toISOString();
  const periodEnd=new Date().toISOString();
  const todayOrders=orders.filter(o=>o.status!=='cancelado'&&new Date(o.createdAt)>=new Date(periodStart));
  const todayManual=manualPayments.filter(p=>new Date(p.createdAt)>=new Date(periodStart));
  const estimated=todayOrders.reduce((a,o)=>a+o.total,0)+todayManual.reduce((a,p)=>a+(p.type==='expense'?-p.amount:p.amount),0);
  const closeCash=(e:React.FormEvent)=>{
    e.preventDefault();
    const actualValue=actual.trim()===''?null:Number(actual.replace(',','.'));
    if(actualValue!==null&&(!Number.isFinite(actualValue)||actualValue<0)){setError('Valor conferido inválido.');return;}
    void execute(async()=>{const result=await requireSupabase().from('delivery_cash_closings').insert({store_id:siteId,period_start:periodStart,period_end:periodEnd,expected_amount:estimated,actual_amount:actualValue,notes:notes.trim()});if(!result.error){setActual('');setNotes('');}return result;});
  };
  if(!hasAny(['novaes-finance']))return null;
  if(!allowed)return <p className="text-amber-400">Somente proprietário ou administrador pode consultar este financeiro.</p>;
  return <section className="space-y-5 text-white">
    <h2 className="text-xl font-black">Controle financeiro avançado</h2>
    <p className="text-sm text-neutral-400">Custos e despesas recorrentes são cadastrados separadamente. Despesas recorrentes não são lançadas automaticamente no saldo: registre o pagamento quando ocorrer para evitar duplicação.</p>
    {error&&<p role="alert" className="text-red-400">{error}</p>}
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 space-y-3">
      <h3 className="font-bold">Custo de cada produto</h3>
      {products.map(product=>{const current=costs.find(c=>c.product_id===product.id);return <div key={product.id} className="flex items-center justify-between gap-3 border-b border-neutral-800 pb-2"><span className="text-sm">{product.name}</span><input key={product.id+':'+(current?.cost??0)} aria-label={'Custo de '+product.name} type="number" min="0" step="0.01" defaultValue={current?.cost??0} disabled={busy} onBlur={e=>{if(Number(e.target.value)!==Number(current?.cost??0))saveCost(product.id,e.target.value);}} className="w-28 bg-neutral-950 rounded-lg p-2 border border-neutral-700" /></div>;})}
    </div>
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 space-y-3">
      <h3 className="font-bold">Despesas recorrentes</h3>
      <form onSubmit={addRecurring} className="grid sm:grid-cols-4 gap-2">
        <input required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descrição" className="bg-neutral-950 p-2 rounded-lg" />
        <input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Valor (R$)" className="bg-neutral-950 p-2 rounded-lg" />
        <input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Categoria" className="bg-neutral-950 p-2 rounded-lg" />
        <label className="text-xs">Dia do vencimento<input type="number" min="1" max="31" value={dueDay} onChange={e=>setDueDay(Number(e.target.value))} className="bg-neutral-950 p-2 rounded-lg w-full" /></label>
        <button disabled={busy} className="bg-red-600 rounded-lg p-2 font-bold sm:col-span-4">Cadastrar despesa</button>
      </form>
      {recurring.map(r=><div key={r.id} className="flex justify-between gap-2 text-sm border-b border-neutral-800 py-2"><span>{r.description} · dia {r.due_day} · {money(Number(r.amount))}</span><button disabled={busy} onClick={()=>void execute(async()=>await requireSupabase().from('delivery_recurring_expenses').update({active:!r.active}).eq('store_id',siteId).eq('id',r.id))} className="underline">{r.active?'Ativa':'Pausada'}</button></div>)}
    </div>
    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 space-y-3">
      <h3 className="font-bold">Fechamento de caixa</h3>
      <p className="text-sm text-neutral-400">Estimativa de movimentações registradas hoje: {money(estimated)}. Não representa dinheiro físico no caixa nem confirma recebimentos.</p>
      <form onSubmit={closeCash} className="grid sm:grid-cols-2 gap-2">
        <input value={actual} onChange={e=>setActual(e.target.value)} placeholder="Valor conferido (R$) — opcional" className="bg-neutral-950 p-2 rounded-lg" />
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observações" className="bg-neutral-950 p-2 rounded-lg" />
        <button disabled={busy} className="bg-red-600 rounded-lg p-2 font-bold sm:col-span-2">Registrar fechamento de hoje</button>
      </form>
      {closings.map(c=><p key={c.id} className="text-sm text-neutral-400 border-b border-neutral-800 pb-2">{new Date(c.closed_at).toLocaleString('pt-BR')} · Estimado {money(Number(c.expected_amount))} · Conferido {c.actual_amount===null?'Não informado':money(Number(c.actual_amount))}</p>)}
    </div>
  </section>;
};
