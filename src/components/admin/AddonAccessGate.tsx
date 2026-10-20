import React from 'react';
import type { AddonCode } from '../../addons/registry';
import { useAddonEntitlements } from '../../context/AddonEntitlementsContext';
import { useStore } from '../../context/StoreContext';

export function AddonAccessGate({ codes, children }: { codes: AddonCode[]; children: React.ReactNode }) {
  const { loading, hasAny } = useAddonEntitlements();
  const { setAdminView } = useStore();
  if (loading) return <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">Conferindo a ativação deste adicional no Master…</section>;
  if (hasAny(codes)) return <>{children}</>;
  return <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100"><h1 className="text-xl font-black">Adicional não ativo</h1><p className="mt-2 text-sm">Este recurso só fica disponível depois da ativação e da confirmação técnica pelo Painel Master.</p><button onClick={() => setAdminView('addons')} className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-neutral-950">Ver adicionais</button></section>;
}
