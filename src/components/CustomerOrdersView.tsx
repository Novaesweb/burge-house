import React, { useState } from 'react';
import { ArrowLeft, Clock, ChevronRight, Package, Bike, CheckCircle2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order } from '../types';

export const CustomerOrdersView: React.FC = () => {
  const { orders, siteId, setActiveOrder, setCustomerView } = useStore();
  const [phone, setPhone] = useState(() => localStorage.getItem(`delivery:customer-phone:${siteId}`) || '');
  const [confirmedPhone, setConfirmedPhone] = useState(() => localStorage.getItem(`delivery:customer-phone:${siteId}`) || '');
  const normalized = confirmedPhone.replace(/\D/g, '');
  // Only orders already accessible through this browser's order tokens are supplied to guests.
  // A phone number alone never unlocks a new order from the database.
  const myOrders = normalized.length >= 10 ? orders.filter(order =>
    order.customerPhone.replace(/\D/g, '') === normalized) : [];

  const handleSelectOrder = (order: Order) => {
    setActiveOrder(order);
    if (order.status === 'entregue') {
      setCustomerView('order-delivered');
    } else {
      setCustomerView('order-status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'entregue':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Entregue
          </span>
        );
      case 'saiu_para_entrega':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 flex items-center gap-1">
            <Bike className="w-3 h-3" /> Saiu para entrega
          </span>
        );
      case 'esperando_motoboy':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Esperando motoboy
          </span>
        );
      case 'itens_separados':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center gap-1">
            <Package className="w-3 h-3" /> Separado
          </span>
        );
      case 'preparando':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Preparando
          </span>
        );
      case 'cancelado':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 flex items-center gap-1">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 flex items-center gap-1">
            <Package className="w-3 h-3" /> Recebido
          </span>
        );
    }
  };

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 py-3 mb-4">
        <button
          onClick={() => setCustomerView('home')}
          className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
          Meus Pedidos
        </h2>
      </div>

      <div className="mb-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-2">
        <label className="block text-sm font-bold text-white">Seu WhatsApp com DDD</label>
        <input inputMode="tel" autoComplete="tel" value={phone} onChange={e=>{setPhone(e.target.value);setConfirmedPhone('');}}
          placeholder="51999999999" className="w-full rounded-xl bg-neutral-950 border border-neutral-700 p-3 text-white" />
        <button type="button" onClick={()=>{const digits=phone.replace(/\D/g,'');if(digits.length>=10&&digits.length<=13){setConfirmedPhone(digits);localStorage.setItem(`delivery:customer-phone:${siteId}`,digits);}}}
          className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white">Continuar sem senha</button>
        <p className="text-xs text-neutral-400">Mostramos somente os pedidos feitos e autorizados neste navegador. Para recuperar pedidos de outro aparelho será necessária uma verificação.</p>
      </div>
      {myOrders.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          {normalized.length < 10 ? 'Informe seu WhatsApp com DDD e toque em Continuar.' : 'Nenhum pedido disponível para este número neste aparelho.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {myOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => handleSelectOrder(order)}
              className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 shadow-md hover:border-red-500/40 transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-99"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-extrabold text-sm text-neutral-900 dark:text-white">
                    Pedido #{order.orderNumber}
                  </span>
                  {getStatusBadge(order.status)}
                </div>

                <div className="text-xs text-neutral-500 line-clamp-1 mb-1">
                  {(order.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ') || 'Nenhum item'}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <span>
                    {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                </div>
              </div>

              <div className="flex-shrink-0 text-neutral-400">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


