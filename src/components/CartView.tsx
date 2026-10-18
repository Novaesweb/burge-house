import { SiteImage } from './SiteImage';
import React from 'react';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBRL } from '../utils/formatters';

export const CartView: React.FC = () => {
  const {
    cart,
    products,
    addToCart,
    updateCartQuantity,
    clearCart,
    cartSubtotal,
    cartTotal,
    siteSettings,
    setCustomerView,
  } = useStore();

  const suggestedProducts = siteSettings.upsellEnabled
    ? products.filter(p => p.isActive && !cart.some(item => item.product.id === p.id)
      && (!siteSettings.upsellProductIds?.length || siteSettings.upsellProductIds.includes(p.id))).slice(0, 3)
    : [];

  const deliveryFee = typeof siteSettings?.deliveryFee === 'number' ? siteSettings.deliveryFee : 5.0;

  if (cart.length === 0) {
    return (
      <div className="py-16 px-4 text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-950/60 border border-red-800/60 text-red-500 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-red-950/50">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-black text-white tracking-tight">
          Seu carrinho está vazio
        </h3>
        <p className="text-sm text-neutral-400 mt-2 max-w-xs mx-auto leading-relaxed">
          Escolha os melhores lanches e delícias do cardápio para fazer seu pedido agora mesmo!
        </p>
        <button
          onClick={() => setCustomerView('home')}
          className="mt-6 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-base shadow-xl shadow-red-950/80 active:scale-95 transition-all inline-flex items-center gap-2"
        >
          <span>Ver Cardápio</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12 px-1">
      {/* Header */}
      <div className="flex items-center justify-between py-4 mb-4 border-b border-neutral-850">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCustomerView('home')}
            className="w-11 h-11 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white hover:bg-neutral-800 active:scale-95 transition-all shadow-md"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Meu Carrinho
            </h2>
            <p className="text-xs text-neutral-400 font-medium">
              {cart.length} {cart.length === 1 ? 'item selecionado' : 'itens selecionados'}
            </p>
          </div>
        </div>

        {/* Clear cart trash button */}
        <button
          onClick={clearCart}
          className="h-11 px-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:text-red-400 hover:border-red-800/60 flex items-center gap-1.5 transition-colors active:scale-95 text-xs font-semibold"
          title="Esvaziar carrinho"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Limpar</span>
        </button>
      </div>

      {/* Cart Layout: 1 col on mobile, 2 cols on lg desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Cart Items List */}
        <div className="lg:col-span-7 space-y-3.5">
          {cart.map((item) => {
            const itemKey = item.id || item.product.id;
            const unitPrice = typeof item.itemUnitPrice === 'number' ? item.itemUnitPrice : item.product.price;
            const itemTotal = unitPrice * (item.quantity || 1);

            return (
              <div
                key={itemKey}
                className="bg-neutral-900/90 rounded-2xl p-4 border border-neutral-800/90 flex flex-col gap-3 shadow-lg shadow-black/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <SiteImage
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-16 h-16 rounded-xl object-cover bg-neutral-800 border border-neutral-700 flex-shrink-0"
                    />
                    <div>
                      <h4 className="text-base font-black text-white leading-snug">
                        {item.product.name}
                      </h4>
                      <div className="text-sm font-bold text-red-400 mt-0.5">
                        {formatBRL(unitPrice)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-neutral-500 font-medium">Subtotal</span>
                    <div className="text-base font-black text-white">
                      {formatBRL(itemTotal)}
                    </div>
                  </div>
                </div>

                {/* Customization Badges */}
                {(item.meatPoint || (item.selectedAddons && item.selectedAddons.length > 0) || (item.removals && item.removals.length > 0) || item.notes) && (
                  <div className="p-3 rounded-xl bg-black/60 border border-neutral-800 space-y-1.5 text-xs">
                    {item.meatPoint && (
                      <div className="flex items-center gap-1 text-orange-400 font-bold">
                        <span>🥩 Ponto:</span>
                        <span className="text-white font-semibold">{item.meatPoint}</span>
                      </div>
                    )}

                    {item.selectedAddons && item.selectedAddons.length > 0 && (
                      <div className="text-emerald-400 font-semibold">
                        <span className="font-bold text-emerald-400">➕ Adicionais: </span>
                        <span className="text-neutral-200">
                          {(item.selectedAddons || []).map((a) => `${a.name} (+${formatBRL(a.price)})`).join(', ')}
                        </span>
                      </div>
                    )}

                    {item.removals && item.removals.length > 0 && (
                      <div className="text-red-400 font-semibold">
                        <span className="font-bold">❌ Sem: </span>
                        <span className="text-neutral-300 line-through">
                          {item.removals.join(', ')}
                        </span>
                      </div>
                    )}

                    {item.notes && (
                      <div className="text-amber-400 font-semibold pt-0.5">
                        <span className="font-bold">📝 Obs: </span>
                        <span className="text-neutral-200 italic">{item.notes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Row: Stepper & Remove */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                  <span className="text-xs text-neutral-400 font-semibold">Quantidade:</span>

                  {/* Large Touch Stepper */}
                  <div className="flex items-center gap-3 bg-black/80 px-3 py-1.5 rounded-xl border border-neutral-700">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(itemKey, (item.quantity || 1) - 1)}
                      className="w-8 h-8 rounded-lg bg-neutral-850 hover:bg-neutral-800 text-white flex items-center justify-center active:scale-90 transition-all font-bold"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="w-4 h-4 stroke-[3]" />
                    </button>
                    <span className="text-base font-black w-6 text-center text-white">
                      {item.quantity || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(itemKey, (item.quantity || 1) + 1)}
                      className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center active:scale-90 transition-all font-bold shadow-md shadow-red-950"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Summary on Desktop */}
        <div className="lg:col-span-5 space-y-4">
          {/* Price Summary Breakdown */}
          <div className="bg-neutral-900/90 rounded-2xl p-4 sm:p-5 border border-neutral-800 space-y-3 shadow-xl">
            <h4 className="text-sm font-black text-neutral-300 uppercase tracking-wider mb-1">
              Resumo dos Valores
            </h4>
            <div className="flex justify-between text-sm text-neutral-300">
              <span>Subtotal dos Itens</span>
              <span className="font-bold text-white text-base">
                {formatBRL(cartSubtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-neutral-300">
              <span>Taxa de Entrega</span>
              <span className="font-bold text-white text-base">
                {formatBRL(deliveryFee)}
              </span>
            </div>
            <div className="pt-3 border-t border-neutral-800 flex justify-between items-baseline">
              <span className="text-lg font-black text-white">
                Total a Pagar
              </span>
              <span className="text-2xl font-black text-red-500">
                {formatBRL(cartTotal)}
              </span>
            </div>
          </div>

          {suggestedProducts.length > 0 && <section className="rounded-2xl border border-amber-700/40 bg-neutral-900 p-4 space-y-3">
            <h3 className="text-lg font-black text-white">Complete seu pedido</h3>
            {suggestedProducts.map(p => <div key={p.id} className="flex items-center gap-3 rounded-xl bg-neutral-950 p-3">
              <div className="flex-1 min-w-0"><p className="text-white font-bold truncate">{p.name}</p><p className="text-amber-400">{formatBRL(p.price)}</p></div>
              <button type="button" onClick={() => addToCart(p, 1)} className="rounded-lg bg-red-600 px-3 py-2 text-white font-bold">+ Adicionar</button>
            </div>)}
          </section>}
          {/* Finalize Button */}
          <button
            onClick={() => setCustomerView('checkout')}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-base sm:text-lg shadow-xl shadow-red-950/80 active:scale-98 transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <span>Avançar para Pagamento</span>
            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};


