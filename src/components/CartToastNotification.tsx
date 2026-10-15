import { SiteImage } from './SiteImage';
import React, { useEffect } from 'react';
import { ShoppingBag, Check, ArrowRight, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBRL } from '../utils/formatters';

export const CartToastNotification: React.FC = () => {
  const { cartToast, setCartToast, setCustomerView } = useStore();

  useEffect(() => {
    if (!cartToast) return;
    const timer = setTimeout(() => {
      setCartToast(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [cartToast, setCartToast]);

  if (!cartToast) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm animate-in slide-in-from-top-4 duration-200">
      <div className="bg-neutral-900/95 backdrop-blur-md text-white border border-emerald-500/50 rounded-2xl p-3 shadow-2xl shadow-black/80 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Small thumbnail or checkmark icon */}
          {cartToast.imageUrl ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-700 bg-black">
              <SiteImage
                src={cartToast.imageUrl}
                alt={cartToast.productName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Adicionado ao Carrinho
              </span>
            </div>
            <p className="text-xs font-black text-white truncate mt-0.5">
              {cartToast.quantity}x {cartToast.productName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => {
              setCustomerView('cart');
              setCartToast(null);
            }}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1 shadow-md shadow-red-950 active:scale-95 transition-all"
          >
            <span>Ver Carrinho</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setCartToast(null)}
            className="p-1 rounded-lg text-neutral-400 hover:text-white"
            aria-label="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};


