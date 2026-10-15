import React from 'react';
import { ShieldAlert, AlertTriangle, Phone, Mail, Lock } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const SiteSuspendedScreen: React.FC = () => {
  const { siteSettings, setIsOwnerLoginModalOpen } = useStore();

  const isInactive = siteSettings.status === 'inactive';
  const isPendingPayment = siteSettings.status === 'pending_payment';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 selection:bg-red-600 selection:text-white">
      <div className="w-full max-w-md bg-neutral-950 border border-neutral-900 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-800 text-red-500 flex items-center justify-center mx-auto shadow-xl shadow-red-950/50">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-red-950 border border-red-800/80 text-red-400 text-xs font-bold uppercase tracking-wider">
            {isPendingPayment ? 'Aguardando Ativação' : isInactive ? 'Site Inativo' : 'Acesso Suspenso'}
          </span>
          <h2 className="text-xl font-black text-white tracking-tight">
            {siteSettings.name}
          </h2>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
            {siteSettings.blockReason ||
              (isPendingPayment
                ? 'Este estabelecimento está aguardando confirmação de pagamento para liberar o cardápio online.'
                : isInactive
                ? 'Este estabelecimento está temporariamente desativado pela administração.'
                : 'O funcionamento online deste site está temporariamente suspenso.')}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 space-y-2 text-left">
          <div className="font-bold text-neutral-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Informações para o Proprietário:</span>
          </div>
          <p>
            Caso você seja o responsável por esta loja, regularize a sua assinatura ou entre em contato com a administração da plataforma para reativação imediata.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsOwnerLoginModalOpen(true)}
            className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-neutral-800 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Acesso do Proprietário</span>
          </button>
        </div>
      </div>
    </div>
  );
};


