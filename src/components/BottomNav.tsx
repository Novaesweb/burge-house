import React from 'react';
import { Home, ShoppingBag, Receipt } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const BottomNav: React.FC = () => {
  const { customerView, setCustomerView, cartCount } = useStore();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-t border-neutral-850 text-neutral-400 py-2.5 px-4 shadow-2xl">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {/* Início */}
        <button
          onClick={() => setCustomerView('home')}
          className={`flex flex-col items-center gap-1 py-1.5 px-5 rounded-2xl transition-all ${
            customerView === 'home' || customerView === 'categories' || customerView === 'products'
              ? 'text-red-500 font-black scale-105'
              : 'text-neutral-400 hover:text-white active:scale-95'
          }`}
          aria-label="Início"
        >
          <Home className="w-6 h-6 stroke-[2.5]" />
          <span className="text-xs font-bold tracking-tight">Início</span>
        </button>

        {/* Carrinho */}
        <button
          onClick={() => setCustomerView('cart')}
          className={`relative flex flex-col items-center gap-1 py-1.5 px-5 rounded-2xl transition-all ${
            customerView === 'cart' || customerView === 'checkout'
              ? 'text-red-500 font-black scale-105'
              : 'text-neutral-400 hover:text-white active:scale-95'
          }`}
          aria-label="Carrinho"
        >
          <div className="relative">
            <ShoppingBag className="w-6 h-6 stroke-[2.5]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-[11px] font-black flex items-center justify-center shadow-lg shadow-red-950 border border-black animate-in zoom-in">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-xs font-bold tracking-tight">Carrinho</span>
        </button>

        {/* Pedidos */}
        <button
          onClick={() => setCustomerView('my-orders')}
          className={`flex flex-col items-center gap-1 py-1.5 px-5 rounded-2xl transition-all ${
            customerView === 'my-orders' ||
            customerView === 'order-status' ||
            customerView === 'order-delivered'
              ? 'text-red-500 font-black scale-105'
              : 'text-neutral-400 hover:text-white active:scale-95'
          }`}
          aria-label="Meus Pedidos"
        >
          <Receipt className="w-6 h-6 stroke-[2.5]" />
          <span className="text-xs font-bold tracking-tight">Pedidos</span>
        </button>
      </div>
    </nav>
  );
};


