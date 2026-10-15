import React, { useEffect } from 'react';
import { Check, ShoppingBag, History } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStore } from '../context/StoreContext';
import { OrderRatingCard } from './OrderRatingCard';

export const DeliveredView: React.FC = () => {
  const { setCustomerView, activeOrder, orders } = useStore();

  const order = activeOrder || orders.find((o) => o.status === 'entregue') || orders[0];

  useEffect(() => {
    // Fire celebratory confetti on mount
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#dc2626', '#10b981', '#f59e0b', '#3b82f6'],
      });
    } catch {
      // safe fallback
    }
  }, []);

  return (
    <div className="py-8 px-2 text-center max-w-sm mx-auto flex flex-col items-center">
      {/* Big Green Checkmark */}
      <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/25 mb-4 animate-in zoom-in duration-300">
        <Check className="w-10 h-10 stroke-[3]" />
      </div>

      <h2 className="text-2xl font-black text-white tracking-tight">
        Pedido entregue!
      </h2>
      <p className="text-sm text-neutral-400 mt-1 font-medium">
        Obrigado por comprar conosco! Esperamos que aproveite sua refeição.
      </p>

      {/* Post-Delivery Rating (Comida e Motoboy 1 a 5 estrelas) */}
      {order && (
        <div className="w-full">
          <OrderRatingCard order={order} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="w-full space-y-3 pt-3">
        <button
          onClick={() => setCustomerView('home')}
          className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-lg shadow-red-600/30 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Fazer um novo pedido</span>
        </button>

        <button
          onClick={() => setCustomerView('my-orders')}
          className="w-full py-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 font-bold text-sm transition-all flex items-center justify-center gap-2"
        >
          <History className="w-4 h-4" />
          <span>Ver histórico de pedidos</span>
        </button>
      </div>
    </div>
  );
};

