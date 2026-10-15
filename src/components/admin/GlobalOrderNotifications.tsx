import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  X,
  CheckCircle,
  Eye,
  Clock,
  User,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Phone,
  DollarSign,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Order } from '../../types';
import {
  startOrderAlertLoop,
  stopOrderAlertLoop,
  isOrderSoundMuted,
  setOrderSoundMuted,
  playSuccessSound,
  getAudioContextState,
  unlockAudio,
} from '../../utils/audioAlert';
import { formatBRL } from '../../utils/formatters';

export const GlobalOrderNotifications: React.FC = () => {
  const { orders, changeOrderStatus, setAdminView, setSelectedAdminOrder } = useStore();

  // Mute state
  const [isMuted, setIsMuted] = useState<boolean>(() => isOrderSoundMuted());
  // Collapsed / expanded state
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  // Audio unlock state (browser autoplay policy)
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState<boolean>(() => {
    return typeof window !== 'undefined' && getAudioContextState() === 'suspended';
  });

  // Track dismissed cards in current session
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(new Set());

  // Loading state per order when accepting
  const [acceptingMap, setAcceptingMap] = useState<Record<string, boolean>>({});

  // Quick detail modal state
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  // Time ticker for elapsed time
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // Track known orders to detect newly arrived orders for notifications
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstMountRef = useRef<boolean>(true);

  // Filter all pending orders with status === 'recebido'
  const pendingOrders = orders.filter((o) => o.status === 'recebido');

  // Orders that are currently visible (not closed via "FECHAR AVISO")
  const visiblePendingOrders = pendingOrders.filter((o) => !dismissedOrderIds.has(o.id));

  // Ticker timer (updates every second for "MM:SS" timer)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
      // Check audio state if suspended
      if (getAudioContextState() === 'suspended') {
        setNeedsAudioUnlock(true);
      } else {
        setNeedsAudioUnlock(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Desktop Native Notification on new order arrival
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      pendingOrders.forEach((o) => knownOrderIdsRef.current.add(o.id));
      return;
    }

    pendingOrders.forEach((order) => {
      if (!knownOrderIdsRef.current.has(order.id)) {
        knownOrderIdsRef.current.add(order.id);

        // Native Notification API
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification(`🔴 NOVO PEDIDO #${order.orderNumber || ''}`, {
              body: `Cliente: ${order.customerName} • Total: ${formatBRL(order.total)}`,
              icon: '/favicon.ico',
            });
          } catch (e) {}
        }
      }
    });
  }, [pendingOrders]);

  // Audio loop manager: continuously loops while there is at least one unaccepted order
  useEffect(() => {
    if (pendingOrders.length > 0 && !isMuted) {
      startOrderAlertLoop(7000);
    } else {
      stopOrderAlertLoop();
    }

    return () => {
      stopOrderAlertLoop();
    };
  }, [pendingOrders.length, isMuted]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setOrderSoundMuted(next);
    if (next) {
      stopOrderAlertLoop();
    } else {
      unlockAudio();
      if (pendingOrders.length > 0) {
        startOrderAlertLoop(7000);
      }
    }
  };

  const handleUnlockAudio = async () => {
    const ok = await unlockAudio();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (ok) {
      setNeedsAudioUnlock(false);
      if (pendingOrders.length > 0 && !isMuted) {
        startOrderAlertLoop(7000);
      }
    }
  };

  const handleAcceptOrder = async (order: Order) => {
    if (acceptingMap[order.id]) return;

    setAcceptingMap((prev) => ({ ...prev, [order.id]: true }));
    try {
      await changeOrderStatus(order.id, 'preparando');
      playSuccessSound();

      // Clean from dismissed if was dismissed
      setDismissedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    } catch (err) {
      console.error('Erro ao aceitar pedido:', err);
      alert('Não foi possível aceitar o pedido. Verifique a conexão com o armazenamento local.');
    } finally {
      setAcceptingMap((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedAdminOrder(order);
    setAdminView('orders');
  };

  const handleDismissCard = (orderId: string) => {
    setDismissedOrderIds((prev) => new Set([...prev, orderId]));
  };

  const handleReopenAll = () => {
    setDismissedOrderIds(new Set());
    setIsMinimized(false);
  };

  // Helper to format elapsed time in MM:SS
  const formatElapsedTime = (createdAt: string) => {
    try {
      const createdTime = new Date(createdAt).getTime();
      const diffSecs = Math.max(0, Math.floor((nowTimestamp - createdTime) / 1000));
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } catch {
      return '00:00';
    }
  };

  // If there are no pending orders in armazenamento local at all, render nothing
  if (pendingOrders.length === 0) {
    return null;
  }

  return (
    <>
      {/* ============================================================ */}
      {/* 1. FLOATING MINIMIZED PILL (When Minimized or all cards dismissed) */}
      {/* ============================================================ */}
      {(isMinimized || visiblePendingOrders.length === 0) && (
        <aside
          role="region"
          aria-label="Central de Pedidos Pendentes"
          className="fixed top-16 sm:top-20 right-3 sm:right-6 z-50 animate-in fade-in slide-in-from-top-4"
        >
          <div className="flex items-center gap-2 bg-[#0f172a]/95 backdrop-blur-md border border-red-500/50 shadow-2xl shadow-red-950/40 p-1.5 sm:p-2 rounded-2xl">
            <button
              type="button"
              onClick={handleReopenAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs transition-transform active:scale-95 shadow-md cursor-pointer"
            >
              <BellRing className="w-4 h-4 animate-bounce text-white" />
              <span>
                {pendingOrders.length} {pendingOrders.length === 1 ? 'NOVO PEDIDO' : 'NOVOS PEDIDOS'}
              </span>
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                  : 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30'
              }`}
              title={isMuted ? 'Desmutar alerta sonoro' : 'Silenciar alerta sonoro'}
              aria-label={isMuted ? 'Desmutar alerta sonoro' : 'Silenciar alerta sonoro'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-pulse" />}
            </button>
          </div>
        </aside>
      )}

      {/* ============================================================ */}
      {/* 2. EXPANDED NOTIFICATION CENTER (STACKED CARDS)              */}
      {/* ============================================================ */}
      {!isMinimized && visiblePendingOrders.length > 0 && (
        <aside
          role="region"
          aria-label="Fila de Novos Pedidos"
          className="fixed top-16 sm:top-20 right-2 sm:right-6 z-50 w-full sm:w-[410px] max-w-[calc(100vw-1rem)] animate-in fade-in slide-in-from-top-4"
        >
          <div className="bg-[#0b132b]/95 backdrop-blur-xl border border-indigo-900/60 shadow-[0_12px_40px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden flex flex-col max-h-[82vh]">
            {/* Top Bar Header */}
            <div className="bg-gradient-to-r from-red-950/80 via-[#0f172a] to-indigo-950/80 px-4 py-3 border-b border-indigo-900/40 flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-red-600/30 border border-red-500/50 flex items-center justify-center text-red-400">
                    <BellRing className="w-4 h-4 animate-bounce" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <span>NOVOS PEDIDOS</span>
                    <span className="text-neutral-400">•</span>
                    <span className="text-red-400">{pendingOrders.length} AGUARDANDO</span>
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    {visiblePendingOrders.length} visíveis na tela
                  </p>
                </div>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1.5">
                {/* Audio unlock prompt if autoplay suspended */}
                {needsAudioUnlock && (
                  <button
                    type="button"
                    onClick={handleUnlockAudio}
                    className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500/30 transition-colors cursor-pointer"
                    title="Clique para autorizar reprodução sonora no navegador"
                  >
                    <Volume2 className="w-3 h-3 animate-pulse" />
                    <span className="hidden sm:inline">Ativar Som</span>
                  </button>
                )}

                {/* Mute / Unmute Button */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`p-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isMuted
                      ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                      : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40'
                  }`}
                  title={isMuted ? 'Desmutar alerta sonoro' : 'Silenciar alerta sonoro temporariamente'}
                  aria-label={isMuted ? 'Desmutar alerta sonoro' : 'Silenciar alerta sonoro temporariamente'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-neutral-400" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />}
                </button>

                {/* Minimize Button */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimizar central de pedidos"
                  aria-label="Minimizar central de pedidos"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Browser Autoplay Notice Banner */}
            {needsAudioUnlock && (
              <div
                onClick={handleUnlockAudio}
                className="bg-amber-950/60 border-b border-amber-800/40 px-3.5 py-1.5 text-[11px] text-amber-200 flex items-center justify-between cursor-pointer hover:bg-amber-900/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>Áudio bloqueado pelo navegador. Toque para habilitar som.</span>
                </div>
                <span className="text-[10px] underline font-bold">Ativar</span>
              </div>
            )}

            {/* Scrollable Stack of Cards */}
            <div className="p-3 space-y-3 overflow-y-auto max-h-[68vh] overscroll-contain">
              {visiblePendingOrders.map((order) => {
                const isAccepting = !!acceptingMap[order.id];
                const elapsedStr = formatElapsedTime(order.createdAt);
                const itemsCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) || order.items?.length || 0;

                return (
                  <div
                    key={order.id}
                    className="bg-gradient-to-b from-[#131d38] to-[#0f172a] rounded-2xl border border-red-500/40 p-3.5 shadow-lg relative group transition-all hover:border-red-500/70"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                        <h4 className="text-sm font-black text-white tracking-tight">
                          NOVO PEDIDO #{order.orderNumber || order.id.slice(-4)}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 border border-white/10 text-[11px] font-mono font-bold text-amber-300">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{elapsedStr}</span>
                        </span>

                        {/* FECHAR AVISO BUTTON */}
                        <button
                          type="button"
                          onClick={() => handleDismissCard(order.id)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Fechar aviso deste pedido (mantém pedido na fila do sistema)"
                          aria-label="Fechar aviso deste pedido"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="space-y-1.5 text-xs text-neutral-200 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Cliente:</span>
                        </span>
                        <span className="font-bold text-white truncate max-w-[190px]">
                          {order.customerName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Total:</span>
                        </span>
                        <span className="font-black text-emerald-400 text-sm">
                          {formatBRL(order.total)}
                        </span>
                      </div>

                      {order.deliveryAddress?.neighborhood && (
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Bairro:</span>
                          </span>
                          <span className="font-medium text-neutral-200 truncate max-w-[190px]">
                            {order.deliveryAddress.neighborhood}
                          </span>
                        </div>
                      )}

                      {/* Summary of Items */}
                      <div className="pt-1 text-[11px] text-neutral-300 bg-black/40 px-2.5 py-1.5 rounded-xl border border-white/5 line-clamp-2">
                        <span className="text-neutral-400 font-semibold">{itemsCount} {itemsCount === 1 ? 'item' : 'itens'}: </span>
                        {order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'Nenhum detalhe'}
                      </div>
                    </div>

                    {/* Card Footer: Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {/* ACEITAR PEDIDO */}
                      <button
                        type="button"
                        disabled={isAccepting}
                        onClick={() => handleAcceptOrder(order)}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
                      >
                        {isAccepting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Aceitando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>ACEITAR PEDIDO</span>
                          </>
                        )}
                      </button>

                      {/* VER PEDIDO */}
                      <button
                        type="button"
                        onClick={() => handleViewOrder(order)}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white border border-indigo-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VER PEDIDO</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Footer if some were closed */}
            {dismissedOrderIds.size > 0 && (
              <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-400 flex-shrink-0">
                <span>{dismissedOrderIds.size} avisos fechados na tela</span>
                <button
                  type="button"
                  onClick={handleReopenAll}
                  className="text-indigo-400 hover:text-indigo-200 font-bold underline cursor-pointer"
                >
                  Reabrir todos
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ============================================================ */}
      {/* 3. QUICK DETAILS MODAL (When clicking VER PEDIDO from here)  */}
      {/* ============================================================ */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-neutral-700 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto">
            <button
              type="button"
              onClick={() => setPreviewOrder(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <h3 className="text-lg font-black text-white">
                Pedido #{previewOrder.orderNumber || previewOrder.id.slice(-4)}
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-bold">
                Recebido
              </span>
            </div>

            <p className="text-xs text-neutral-400 mb-4">
              Cliente: {previewOrder.customerName} • {previewOrder.customerPhone}
            </p>

            <div className="bg-neutral-950 rounded-2xl p-4 border border-neutral-800 space-y-2 mb-4 max-h-[45vh] overflow-y-auto">
              {previewOrder.items?.map((it, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 text-xs py-1 border-b border-neutral-900 last:border-0">
                  <div>
                    <span className="font-bold text-white">{it.quantity}x {it.name}</span>
                    {it.notes && <p className="text-[11px] text-neutral-400 italic">Obs: {it.notes}</p>}
                  </div>
                  <span className="font-mono text-neutral-300">{formatBRL(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm font-black text-white mb-5 px-1">
              <span>Total do Pedido:</span>
              <span className="text-emerald-400 text-base">{formatBRL(previewOrder.total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  handleAcceptOrder(previewOrder);
                  setPreviewOrder(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Aceitar Agora</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAdminOrder(previewOrder);
                  setAdminView('orders');
                  setPreviewOrder(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Abrir na Tela de Pedidos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


