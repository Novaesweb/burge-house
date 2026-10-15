import React, { useEffect, useState, useRef } from 'react';
import {
  Volume2,
  Bell,
  AlertTriangle,
  Check,
  Bike,
  Package,
  DollarSign,
  X,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  enableAudio,
  playNewOrderSound,
  playUrgentOrderSound,
  playSuccessSound,
  playStatusChangeSound,
  isAudioEnabled,
} from '../utils/audioAlert';
import { OrderStatus } from '../types';
import { formatBRL } from '../utils/formatters';

interface RealtimeToast {
  id: string;
  title: string;
  message: string;
  type: 'new_order' | 'status_change' | 'delivery_done' | 'urgent';
  createdAt: number;
}

export const AudioNotificationBanner: React.FC = () => {
  const { orders, appMode, activeOrder, setCustomerView } = useStore();
  const [hasPromptAccepted, setHasPromptAccepted] = useState<boolean>(() => {
    return localStorage.getItem('delivery_sound_accepted') === 'true';
  });
  const [activeToast, setActiveToast] = useState<RealtimeToast | null>(null);
  const [urgentOrderCount, setUrgentOrderCount] = useState<number>(0);

  // Keep a map of previous order states to detect real-time changes
  const prevOrdersMapRef = useRef<Map<string, OrderStatus>>(new Map());
  const isFirstLoadRef = useRef<boolean>(true);

  // Monitor real-time armazenamento local changes on orders safely
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    if (isFirstLoadRef.current) {
      // First load: populate map without triggering sounds
      orders.forEach((o) => {
        if (o?.id) prevOrdersMapRef.current.set(o.id, o.status);
      });
      isFirstLoadRef.current = false;
      return;
    }

    try {
      // Inspect transitions
      for (const order of orders) {
        if (!order?.id) continue;
        const prevStatus = prevOrdersMapRef.current.get(order.id);

        const orderNum = order.orderNumber || '---';
        const custName = order.customerName || 'Cliente';
        const formattedTotal = formatBRL(order.total);
        const payMethod = (order.paymentMethod || 'pix').toUpperCase();

        // 1. BRAND NEW ORDER ARRIVED
        if (!prevStatus) {
          if (hasPromptAccepted && appMode !== 'admin') {
            playNewOrderSound();
          }

          if (appMode === 'admin') {
            setActiveToast({
              id: `toast-${Date.now()}`,
              title: `🔔 Novo Pedido #${orderNum} Recebido!`,
              message: `${custName} • ${formattedTotal} (${payMethod})`,
              type: 'new_order',
              createdAt: Date.now(),
            });
          }
          break;
        }

        // 2. STATUS TRANSITION DETECTED
        if (prevStatus !== order.status) {
          if (order.status === 'entregue') {
            if (hasPromptAccepted) playSuccessSound();

            if (appMode === 'admin') {
              setActiveToast({
                id: `toast-${Date.now()}`,
                title: `💰 Pedido #${orderNum} Entregue!`,
                message: `Faturamento atualizado (+${formattedTotal})`,
                type: 'delivery_done',
                createdAt: Date.now(),
              });
            } else if (appMode === 'customer' && activeOrder?.id === order.id) {
              setActiveToast({
                id: `toast-${Date.now()}`,
                title: `✅ Pedido #${orderNum} Entregue!`,
                message: `Seu pedido foi entregue com sucesso! Bom apetite!`,
                type: 'delivery_done',
                createdAt: Date.now(),
              });
              setCustomerView('order-delivered');
            }
          } else if (order.status === 'saiu_para_entrega') {
            if (hasPromptAccepted) playStatusChangeSound();

            if (appMode === 'customer' && activeOrder?.id === order.id) {
              setActiveToast({
                id: `toast-${Date.now()}`,
                title: `🛵 Saiu para Entrega!`,
                message: `O motoboy já está a caminho do seu endereço!`,
                type: 'status_change',
                createdAt: Date.now(),
              });
            } else if (appMode === 'admin') {
              setActiveToast({
                id: `toast-${Date.now()}`,
                title: `🛵 Pedido #${orderNum} em rota!`,
                message: `Pedido despachado para entrega com o motoboy.`,
                type: 'status_change',
                createdAt: Date.now(),
              });
            }
          } else if (order.status === 'preparando') {
            if (hasPromptAccepted) playStatusChangeSound();

            if (appMode === 'customer' && activeOrder?.id === order.id) {
              setActiveToast({
                id: `toast-${Date.now()}`,
                title: `👨‍🍳 Pedido Confirmado!`,
                message: `A cozinha já começou a preparar seu pedido.`,
                type: 'status_change',
                createdAt: Date.now(),
              });
            }
          } else if (order.status === 'itens_separados') {
            if (hasPromptAccepted) playStatusChangeSound();

            if (appMode === 'customer' && activeOrder?.id === order.id) {
              setActiveToast({
                id: `toast-${Date.now()}`,
                title: `📦 Itens Separados!`,
                message: `Seu pedido já foi embalado e conferido pela equipe.`,
                type: 'status_change',
                createdAt: Date.now(),
              });
            }
          } else if (order.status === 'esperando_motoboy') {
            if (hasPromptAccepted) playStatusChangeSound();

            if (appMode === 'customer' && activeOrder?.id === order.id) {
              setActiveToast({
                id: `toast-${Date.now()}`,
                title: `🛵 Esperando Motoboy!`,
                message: `Pedido pronto na loja, aguardando saída do motoboy.`,
                type: 'status_change',
                createdAt: Date.now(),
              });
            }
          }
        }
      }

      // Refresh map
      const newMap = new Map<string, OrderStatus>();
      orders.forEach((o) => {
        if (o?.id) newMap.set(o.id, o.status);
      });
      prevOrdersMapRef.current = newMap;
    } catch (err) {
      console.warn('Notification processing notice:', err);
    }
  }, [orders, appMode, hasPromptAccepted, activeOrder?.id, setCustomerView]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 5500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  // Continuous Audio Alarm for New Unaccepted Orders & 15-Minute Warning Buzzer
  useEffect(() => {
    // O painel administrativo usa a Central de Novos Pedidos, que toca o
    // alerta em ciclo próprio. Mantemos este componente para o pedido do
    // navegador autorizar som e notificações, sem duplicar o toque.
    if (appMode === 'admin' || !orders) return;

    const checkPendingAndUrgentOrders = () => {
      try {
        const now = Date.now();
        const unacceptedOrders = orders.filter((o) => o?.status === 'recebido');
        const waitingOrders = orders.filter((order) => {
          if (!order || (order.status !== 'preparando' && order.status !== 'recebido') || !order.createdAt) return false;
          const orderTime = new Date(order.createdAt).getTime();
          if (isNaN(orderTime)) return false;
          const diffMinutes = (now - orderTime) / (1000 * 60);
          return diffMinutes >= 15;
        });

        setUrgentOrderCount(waitingOrders.length);

        // Chime priority: 1) New unaccepted orders continuous alert (every 15s), 2) 15-min overdue buzzer
        if (hasPromptAccepted) {
          if (unacceptedOrders.length > 0) {
            playNewOrderSound();
          } else if (waitingOrders.length > 0) {
            playUrgentOrderSound();
          }
        }
      } catch (e) {
        console.warn('Orders check notice:', e);
      }
    };

    checkPendingAndUrgentOrders();
    const interval = setInterval(checkPendingAndUrgentOrders, 15000);
    return () => clearInterval(interval);
  }, [orders, hasPromptAccepted, appMode]);

  const handleAcceptAudio = () => {
    enableAudio();
    playNewOrderSound();
    setHasPromptAccepted(true);
    localStorage.setItem('delivery_sound_accepted', 'true');
  };

  return (
    <>
      {/* 1. First Visit Prompt: "Notificações quando entrar tem que aceitar" */}
      {!hasPromptAccepted && appMode === 'admin' && (
        <div className="fixed top-3 left-3 right-3 max-w-md mx-auto z-50 p-3.5 rounded-2xl bg-neutral-900/95 border border-red-500/40 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/40 text-red-500 flex items-center justify-center flex-shrink-0 animate-pulse">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">
                Ativar Alertas em Tempo Real com Som
              </p>
              <p className="text-[10px] text-neutral-400">
                Ouça o aviso instantâneo de novos pedidos e atualizações de entrega
              </p>
            </div>
          </div>

          <button
            onClick={handleAcceptAudio}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black shadow-md shadow-red-950/60 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Ativar</span>
          </button>
        </div>
      )}

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

      {/* 3. Persistent Urgent Banner when an order is waiting > 15 minutes */}
      {urgentOrderCount > 0 && appMode === 'admin' && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-45 p-3 rounded-2xl bg-red-600 text-white shadow-2xl shadow-red-950 border border-red-400 animate-pulse flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-200" />
            <div>
              <p className="text-xs font-black tracking-tight">
                ⚠️ ALERTA: {urgentOrderCount} pedido(s) aguardando há +15 min!
              </p>
              <p className="text-[10px] text-red-100">
                Toque em "Aceitar Pedido" para parar o som de alerta
              </p>
            </div>
          </div>
          <button
            onClick={() => playUrgentOrderSound()}
            className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/40 text-[11px] font-bold text-white flex items-center gap-1 flex-shrink-0"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Ouvir</span>
          </button>
        </div>
      )}
    </>
  );
};



