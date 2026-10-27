import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, Bike, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { playSuccessSound, playStatusChangeSound } from '../utils/audioAlert';
import type { OrderStatus } from '../types';

interface RealtimeToast {
  id: string; title: string; message: string;
  type: 'status_change' | 'delivery_done'; createdAt: number;
}

// Public customer notifications only. The administrative queue owns new-order
// alarms, repetition, urgency and sound permissions in its separate component.
export const AudioNotificationBanner: React.FC = () => {
  const { orders, appMode, activeOrder, siteId, setCustomerView } = useStore();
  const [hasPromptAccepted] = useState(() => {
    try { return localStorage.getItem('delivery_sound_accepted') === 'true'; }
    catch { return false; }
  });
  const [activeToast, setActiveToast] = useState<RealtimeToast | null>(null);
  const previous = useRef<{ identity: string; status: OrderStatus | null }>({ identity: '', status: null });
  const identity = appMode === 'customer' && activeOrder?.siteId === siteId ? `${siteId}:${activeOrder.id}` : '';
  const order = identity ? orders.find(item => item.id === activeOrder?.id && item.siteId === siteId) : undefined;

  useEffect(() => {
    if (!identity || !order) {
      previous.current = { identity: '', status: null };
      setActiveToast(null);
      return;
    }
    const before = previous.current;
    previous.current = { identity, status: order.status };
    if (before.identity !== identity || before.status === order.status) {
      if (before.identity !== identity) setActiveToast(null);
      return;
    }
    const messages: Partial<Record<OrderStatus, { title: string; message: string }>> = {
      preparando: { title: '👨‍🍳 Pedido Confirmado!', message: 'A cozinha já começou a preparar seu pedido.' },
      itens_separados: { title: '📦 Itens Separados!', message: 'Seu pedido já foi embalado e conferido pela equipe.' },
      esperando_motoboy: { title: '🛵 Esperando Motoboy!', message: 'Pedido pronto na loja, aguardando saída do motoboy.' },
      saiu_para_entrega: { title: '🛵 Saiu para Entrega!', message: 'O motoboy já está a caminho do seu endereço!' },
      entregue: { title: `✅ Pedido #${order.orderNumber || '---'} Entregue!`, message: 'Seu pedido foi entregue com sucesso! Bom apetite!' },
    };
    const message = messages[order.status];
    if (!message) return;
    if (hasPromptAccepted) {
      if (order.status === 'entregue') playSuccessSound();
      else playStatusChangeSound();
    }
    setActiveToast({ id: `toast-${Date.now()}`, ...message, type: order.status === 'entregue' ? 'delivery_done' : 'status_change', createdAt: Date.now() });
    if (order.status === 'entregue') setCustomerView('order-delivered');
  }, [identity, order?.status, hasPromptAccepted, setCustomerView]);

  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => setActiveToast(null), 5500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  if (appMode !== 'customer') return null;
  return (
    <>
      {/* 2. REAL-TIME TOAST ALERT (Appears instantly on state change without refreshing) */}
      {activeToast && (
        <div className="fixed top-4 left-3 right-3 max-w-md mx-auto z-50 animate-in slide-in-from-top-4 duration-300">
          <div
            className={`p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 ${
              activeToast.type === 'delivery_done'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-white shadow-emerald-950/50'
                : activeToast.type === 'status_change'
                ? 'bg-blue-950/90 border-blue-500/40 text-white shadow-blue-950/50'
                : 'bg-neutral-900/95 border-orange-500/40 text-white shadow-orange-950/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  activeToast.type === 'delivery_done'
                    ? 'bg-emerald-500 text-white'
                    : activeToast.type === 'status_change'
                    ? 'bg-blue-500 text-white'
                    : 'bg-orange-500 text-white'
                }`}
              >
                {activeToast.type === 'delivery_done' ? (
                  <Check className="w-5 h-5 stroke-[2.5]" />
                ) : activeToast.type === 'status_change' ? (
                  <Bike className="w-5 h-5" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-black tracking-tight leading-tight">
                  {activeToast.title}
                </h4>
                <p className="text-[11px] text-neutral-300 mt-0.5 leading-snug">
                  {activeToast.message}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveToast(null)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </>
  );
};