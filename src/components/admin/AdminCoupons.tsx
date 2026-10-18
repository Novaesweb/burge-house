import React, { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { requireSupabase } from '../../lib/supabase';

type Coupon = { store_id: string; code: string; discount_type: 'percent'|'fixed'; discount_value: number; min_order: number; max_uses: number|null; used_count: number; expires_at: string|null; active: boolean };

export const AdminCoupons: React.FC = () => {
  const { siteId } = useStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'percent'|'fixed'>('percent');
  const [value, setValue] = useState('');
  const [minimum, setMinimum] = useState('0');
  const [limit, setLimit] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    requireSupabase().from('delivery_coupons').select('*').eq('store_id', siteId).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError('Não foi possível carregar os cupons. Verifique suas permissões.');
        else setCoupons((data || []) as Coupon[]);
      });
    return () => { active = false; };
  }, [siteId, refresh]);

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const normalized = code.trim().toUpperCase();
      const amount = Number(value.replace(',', '.'));
      const min = Number(minimum.replace(',', '.'));
      if (!/^[A-Z0-9_-]{3,30}$/.test(normalized)) throw new Error('Código deve ter de 3 a 30 letras, números, _ ou -.');
      if (!Number.isFinite(amount) || amount <= 0 || (kind === 'percent' && amount > 100)) throw new Error('Valor de desconto inválido.');
      if (!Number.isFinite(min) || min < 0) throw new Error('Pedido mínimo inválido.');
      const maxUses = limit ? Number(limit) : null;
      if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) throw new Error('Limite de usos inválido.');
      const { error } = await requireSupabase().from('delivery_coupons').insert({
        store_id: siteId, code: normalized, discount_type: kind, discount_value: amount,
        min_order: min, max_uses: maxUses, expires_at: expiry ? new Date(expiry + 'T23:59:59').toISOString() : null,
      });
      if (error) throw new Error('Não foi possível cadastrar o cupom. Confira se o código já existe e se você tem acesso.');
      setCode(''); setValue(''); setLimit(''); setExpiry(''); setRefresh(n => n + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao salvar cupom.'); }
    finally { setSaving(false); }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    setError('');
    const { error } = await requireSupabase().from('delivery_coupons').update({ active: !coupon.active })
      .eq('store_id', siteId).eq('code', coupon.code);
    if (error) setError('Não foi possível alterar o cupom.');
    else setRefresh(n => n + 1);
  };

  return <section className="space-y-5 text-white">
    <header><h1 className="text-2xl font-black">Central de cupons</h1>
      <p className="text-sm text-neutral-400">Cadastre e gerencie cupons exclusivos desta loja. A aplicação no checkout será liberada após a validação de descontos no servidor.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-950 border border-red-800 p-3">{error}</p>}
    <form onSubmit={createCoupon} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Código<input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="BEMVINDO10" className="mt-1 w-full rounded-xl bg-neutral-950 p-3 border border-neutral-700" /></label>
      <label className="text-sm">Tipo<select value={kind} onChange={e => setKind(e.target.value as 'percent'|'fixed')} className="mt-1 w-full rounded-xl bg-neutral-950 p-3 border border-neutral-700"><option value="percent">Porcentagem (%)</option><option value="fixed">Valor fixo (R$)</option></select></label>
      <label className="text-sm">Desconto<input required inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-950 p-3 border border-neutral-700" /></label>
      <label className="text-sm">Pedido mínimo (R$)<input required inputMode="decimal" value={minimum} onChange={e => setMinimum(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-950 p-3 border border-neutral-700" /></label>
      <label className="text-sm">Limite de usos (opcional)<input type="number" min="1" value={limit} onChange={e => setLimit(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-950 p-3 border border-neutral-700" /></label>
      <label className="text-sm">Vencimento (opcional)<input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-950 p-3 border border-neutral-700" /></label>
      <button disabled={saving} className="sm:col-span-2 rounded-xl bg-red-600 p-3 font-black disabled:opacity-50">{saving ? 'Salvando...' : 'Cadastrar cupom'}</button>
    </form>
    <div className="space-y-2">{coupons.map(c => <div key={c.code} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 flex items-center justify-between gap-3">
      <div><strong>{c.code}</strong><p className="text-sm text-neutral-400">{c.discount_type === 'percent' ? c.discount_value + '%' : 'R$ ' + Number(c.discount_value).toFixed(2)} de desconto · Mínimo R$ {Number(c.min_order).toFixed(2)} · {c.used_count} usos</p></div>
      <button type="button" onClick={() => void toggleCoupon(c)} className={'rounded-lg px-3 py-2 font-bold ' + (c.active ? 'bg-green-800' : 'bg-neutral-700')}>{c.active ? 'Ativo' : 'Inativo'}</button>
    </div>)}{coupons.length === 0 && <p className="text-neutral-400">Nenhum cupom cadastrado.</p>}</div>
  </section>;
};
