import React, { useState, useEffect } from 'react';
import {
  Check,
  Clock,
  MapPin,
  ChevronRight,
  Bike,
  Package,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChefHat,
  Boxes,
  XCircle,
  Inbox,
  BellRing,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { OrderStatus } from '../types';
import { formatBRL } from '../utils/formatters';
import { PixWhatsAppProofCard } from './PixWhatsAppProofCard';
import { OrderRatingCard } from './OrderRatingCard';
import { MarketingConsent } from './MarketingConsent';

export const OrderStatusView: React.FC = () => {
  const {
    activeOrder,
    orders,
    setCustomerView,
    siteSettings,
  } = useStore();

  const [showDetails, setShowDetails] = useState(false);

  // If no active order, pick the most recent one
  const order = activeOrder || orders[0];

  // Auto-switch to delivered celebration screen when order status becomes 'entregue'
  useEffect(() => {
    if (order?.status === 'entregue') {
      const timer = setTimeout(() => {
        setCustomerView('order-delivered');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [order?.status, setCustomerView]);

  if (!order) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-14 h-14 text-neutral-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white">
          Nenhum pedido ativo no momento
        </h3>
        <button
          onClick={() => setCustomerView('home')}
          className="mt-4 px-6 py-3 rounded-2xl bg-red-600 text-white text-sm font-black active:scale-95 transition-all"
        >
          Fazer um pedido
        </button>
      </div>
    );
  }

  // 6 Canonical Customer Stages
  // 0: Pedido Recebido (Aguardando aceite da loja)
  // 1: Preparando (Cozinha aceitou e está preparando)
  // 2: Itens separados, 3: Esperando motoboy, 4: Saiu para entrega, 5: Entregue
  const getLevel = (status: OrderStatus): number => {
    switch (status) {
      case 'recebido':
        return 0;
      case 'preparando':
        return 1;
      case 'itens_separados':
        return 2;
      case 'esperando_motoboy':
        return 3;
      case 'saiu_para_entrega':
        return 4;
      case 'entregue':
        return 5;
      case 'cancelado':
        return -1;
      default:
        if ((status as any) === 'pronto') return 2;
        if ((status as any) === 'aguardando_entregador' || (status as any) === 'entregador_aceitou') return 3;
        return 0;
    }
  };

  const currentLevel = getLevel(order.status);
  const isReceived = order.status === 'recebido';
  const isCancelled = order.status === 'cancelado';
  const isDelivered = order.status === 'entregue';
  const isOutForDelivery = order.status === 'saiu_para_entrega';

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Hoje';
    const date = new Date(isoString);
    return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const stages = [
    {
      level: 0,
      title: '0. Pedido Recebido',
      subtitle: isReceived
        ? 'Aguardando o restaurante aceitar seu pedido'
        : 'Pedido recebido e confirmado pela loja',
      icon: <Inbox className="w-4 h-4" />,
    },
    {
      level: 1,
      title: '1. Preparando',
      subtitle:
        currentLevel > 1
          ? 'Preparo concluído pela cozinha'
          : currentLevel === 1
          ? 'Cozinha preparando seus itens com muito carinho'
          : 'Aguardando aceite da loja para iniciar o preparo',
      icon: <ChefHat className="w-4 h-4" />,
    },
    {
      level: 2,
      title: '2. Itens separados',
      subtitle: 'Pedido embalado e conferido',
      icon: <Boxes className="w-4 h-4" />,
    },
    {
      level: 3,
      title: '3. Esperando motoboy',
      subtitle: 'Aguardando saída do motoboy da loja',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      level: 4,
      title: '4. Saiu para entrega',
      subtitle: 'Pedido a caminho do seu endereço',
      icon: <Bike className="w-4 h-4" />,
    },
    {
      level: 5,
      title: '5. Entregue',
      subtitle: 'Pedido entregue com sucesso! Bom apetite!',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
  ];

  return (
    <div className="pb-12 pt-3 text-center px-1">
      {/* Status Hero Circle */}
      {isCancelled ? (
        <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-red-500/40 text-red-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-950/60 animate-in zoom-in">
          <XCircle className="w-10 h-10 stroke-[2.5]" />
        </div>
      ) : isDelivered ? (
        <div className="w-20 h-20 rounded-3xl bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-950/60 animate-in zoom-in">
          <Check className="w-10 h-10 stroke-[3]" />
        </div>
      ) : isOutForDelivery ? (
        <div className="w-20 h-20 rounded-3xl bg-blue-950 border border-blue-500 text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-950/60 animate-pulse">
          <Bike className="w-10 h-10" />
        </div>
      ) : isReceived ? (
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-950/80 animate-in zoom-in">
          <div className="absolute inset-0 rounded-3xl bg-blue-500/30 animate-ping -z-10" />
          <Inbox className="w-10 h-10 stroke-[2.2]" />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-600 to-orange-600 text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange-950/60 animate-in zoom-in">
          <ChefHat className="w-10 h-10" />
        </div>
      )}

      {/* Main Title & Subtitle */}
      <h2 className="text-2xl font-black text-white tracking-tight">
        {isCancelled
          ? 'Pedido Cancelado'
          : isDelivered
          ? 'Pedido Entregue!'
          : isOutForDelivery
          ? 'Saiu para Entrega!'
          : currentLevel === 3
          ? 'Esperando Motoboy!'
          : currentLevel === 2
          ? 'Itens Separados!'
          : currentLevel === 1
          ? 'Preparando seu Pedido!'
          : 'Pedido Recebido!'}
      </h2>
      <p className="text-sm text-neutral-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
        {isCancelled
          ? 'Este pedido foi cancelado pelo estabelecimento. Entre em contato se precisar de ajuda.'
          : isDelivered
          ? 'Seu pedido foi entregue com sucesso! Bom apetite!'
          : isOutForDelivery
          ? 'Seu pedido já saiu para entrega e está a caminho do seu endereço!'
          : currentLevel === 3
          ? 'Seu pedido está pronto na loja aguardando a saída do motoboy.'
          : currentLevel === 2
          ? 'Todos os itens foram embalados e conferidos.'
          : currentLevel === 1
          ? 'O restaurante aceitou seu pedido! A cozinha já está preparando tudo com muito carinho.'
          : 'Recebemos seu pedido! Aguardando o restaurante aceitar para iniciar o preparo.'}
      </p>

      {/* Clear notice when waiting for restaurant to accept */}
      {isReceived && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-950/90 via-indigo-950/80 to-neutral-900 border border-blue-500/40 text-left my-4 shadow-xl space-y-1.5 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
            <span className="text-xs font-black text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5" />
              <span>Aguardando Aceite da Loja</span>
            </span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed font-medium">
            Seu pedido foi enviado para o restaurante. O estabelecimento foi notificado e irá aceitar a qualquer momento para iniciar o preparo na cozinha.
          </p>
        </div>
      )}

      {/* Order Info Card (Nº do pedido & Previsão) */}
      <div className="bg-neutral-900/90 rounded-3xl p-4 my-5 border border-neutral-800 flex items-center justify-around text-center shadow-lg">
        <div>
          <span className="text-xs font-bold text-neutral-400 block uppercase tracking-wider">
            Nº do pedido
          </span>
          <span className="text-lg font-black text-white">
            #{order.orderNumber}
          </span>
        </div>
        <div className="w-px h-8 bg-neutral-800" />
        <div>
          <span className="text-xs font-bold text-neutral-400 block uppercase tracking-wider">
            Previsão
          </span>
          <span className="text-lg font-black text-white flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4 text-red-500" />
            {isDelivered ? 'Entregue' : isCancelled ? 'Cancelado' : `${order.estimatedMinutes || 40} min`}
          </span>
        </div>
      </div>

      {/* PROMINENT PIX WHATSAPP PROOF CARD (When PIX is chosen and pending) */}
      {order.paymentMethod === 'pix' && !order.isPaid && !isCancelled && (
        <PixWhatsAppProofCard order={order} />
      )}

      {/* POST-DELIVERY RATING CARD (Food & Delivery 1-5 Stars) */}
      {isDelivered && (
        <OrderRatingCard order={order} />
      )}

      {/* 5-Step Vertical Status Timeline */}
      {!isCancelled && (
        <div className="bg-neutral-900/90 rounded-3xl p-5 sm:p-6 border border-neutral-800 text-left my-4 shadow-xl">
          <div className="relative pl-7 space-y-6">
            {/* Vertical connecting line */}
            <div className="absolute left-[13px] top-3 bottom-3 w-0.5 bg-neutral-800" />

            {stages.map((stage) => {
              const isPast = currentLevel > stage.level;
              const isCurrent = currentLevel === stage.level;

              return (
                <div key={stage.level} className="relative flex items-start gap-3.5">
                  {/* Circle Icon Badge */}
                  <div
                    className={`absolute -left-7 w-7 h-7 rounded-2xl flex items-center justify-center transition-all ${
                      isPast
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950'
                        : isCurrent
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white ring-4 ring-red-500/20 shadow-lg shadow-red-950 animate-pulse'
                        : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : stage.icon}
                  </div>

                  <div>
                    <h4
                      className={`text-sm sm:text-base font-black tracking-tight ${
                        isCurrent
                          ? 'text-white'
                          : isPast
                          ? 'text-emerald-400 font-bold'
                          : 'text-neutral-500'
                      }`}
                    >
                      {stage.title}
                    </h4>
                    <p
                      className={`text-xs mt-0.5 ${
                        isCurrent
                          ? 'text-neutral-300 font-medium'
                          : 'text-neutral-500'
                      }`}
                    >
                      {stage.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsible Order Summary Breakdown */}
      <div className="bg-neutral-900/90 rounded-3xl p-4 border border-neutral-800 text-left shadow-lg space-y-3">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between text-sm font-bold text-neutral-300"
        >
          <span>Ver Itens e Detalhes da Compra</span>
          <ChevronRight
            className={`w-4 h-4 transition-transform ${
              showDetails ? 'rotate-90 text-red-500' : 'text-neutral-500'
            }`}
          />
        </button>

        {showDetails && (
          <div className="pt-3 border-t border-neutral-800 space-y-3 animate-in fade-in">
            {/* Items */}
            <div className="space-y-2">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-white font-medium">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="text-neutral-400 font-bold">
                    {formatBRL((item.price || 0) * (item.quantity || 1))}
                  </span>
                </div>
              ))}
            </div>

            {/* Payment Status Detail */}
            <div className="p-3 rounded-2xl bg-black border border-neutral-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 font-semibold">Forma de Pagamento:</span>
                <span className="font-bold text-white uppercase">
                  {order.paymentMethod === 'pix'
                    ? 'PIX'
                    : order.paymentMethod === 'cash'
                    ? 'Dinheiro'
                    : 'Cartão na Entrega'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-neutral-850">
                <span className="text-neutral-400 font-semibold">Status do Pagamento:</span>
                {order.isPaid ? (
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmado pela Loja (Pago)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-950 border border-amber-500/40 text-amber-400 font-black flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pendente de Validação</span>
                  </span>
                )}
              </div>

              {order.paymentMethod === 'pix' && !order.isPaid && (
                <p className="text-[11px] text-purple-300 bg-purple-950/40 p-2.5 rounded-xl border border-purple-500/30 leading-relaxed mt-1">
                  💡 <strong>Aguardando confirmação:</strong> O restaurante confirmará seu pagamento assim que você enviar o comprovante via WhatsApp.
                </p>
              )}
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-neutral-800/80 flex justify-between items-baseline text-sm">
              <span className="font-bold text-neutral-300">Total do Pedido:</span>
              <span className="font-black text-red-500 text-base">
                {formatBRL(order.total)}
              </span>
            </div>

            {/* Delivery address */}
            <div className="p-3 rounded-2xl bg-black/70 border border-neutral-800 text-xs text-neutral-300 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>
                {typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null
                  ? `${order.deliveryAddress.street}, ${order.deliveryAddress.number} (${order.deliveryAddress.neighborhood})`
                  : order.deliveryAddress}
              </span>
            </div>
          </div>
        )}
        <MarketingConsent key={order.id} orderId={order.id} />
      </div>
    </div>
  );
};


