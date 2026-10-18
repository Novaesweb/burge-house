import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import burgerHouseWordmark from '../assets/brand/burger-house-wordmark.png';

export const Header: React.FC = () => {
  const { siteSettings, cartCount, setCustomerView, appMode, setAppMode } = useStore();

  return (
    <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-neutral-900 text-white px-4 sm:px-6 py-3 sm:py-4">
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
        {/* Store Logo & Info */}
        <div
          onClick={() => {
            setAppMode('customer');
            setCustomerView('home');
          }}
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          <div>
            <img src={burgerHouseWordmark} alt={siteSettings.name} className="h-12 w-[152px] object-contain object-left sm:h-14 sm:w-[218px]" />
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-400 border border-red-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {siteSettings.isOpen ? 'Aberto' : 'Fechado'}
              </span>
              <span className="text-[11px] text-neutral-400 font-medium">
                {siteSettings.openingHours || '10:00 às 23:00'}
              </span>
            </div>
          </div>
        </div>

        {/* Right actions: Desktop Nav Links + Cart button with Red Gradient */}
        <div className="flex items-center gap-3">
          {appMode === 'customer' && (
            <>
              {/* Desktop quick links */}
              <div className="hidden md:flex items-center gap-1 bg-neutral-900/80 border border-neutral-800 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setCustomerView('home')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Início
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerView('categories')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Categorias
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerView('my-orders')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Meus Pedidos
                </button>
              </div>

              <button
                onClick={() => setCustomerView('cart')}
                className="relative h-10 px-3.5 rounded-2xl bg-gradient-to-br from-neutral-900 to-black border border-neutral-800 hover:border-red-500/50 flex items-center gap-2 text-white transition-all active:scale-95 shadow-md shadow-black/80 cursor-pointer"
                aria-label="Ver carrinho"
              >
                <ShoppingBag className="w-5 h-5 text-neutral-200" />
                <span className="hidden sm:inline text-xs font-bold text-neutral-200">Carrinho</span>
                {cartCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-[11px] font-black flex items-center justify-center shadow-lg shadow-red-950/80 animate-in fade-in zoom-in border border-black">
                    {cartCount}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};


