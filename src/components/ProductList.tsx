import { SiteImage } from './SiteImage';
import React from 'react';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';
import { formatBRL } from '../utils/formatters';

interface ProductListProps {
  onBack?: () => void;
}

export const ProductList: React.FC<ProductListProps> = ({ onBack }) => {
  const {
    products,
    categories,
    selectedCategoryId,
    setSelectedProductForModal,
    addToCart,
    setCustomerView,
  } = useStore();

  const currentCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0];

  const categoryProducts = products.filter(
    (p) => (!selectedCategoryId || p.categoryId === selectedCategoryId) && p.isActive !== false
  );

  const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  return (
    <div className="pb-12 px-1">
      {/* Category Header */}
      <div className="flex items-center gap-3 py-4 mb-3 border-b border-neutral-850">
        <button
          onClick={() => {
            if (onBack) onBack();
            else setCustomerView('home');
          }}
          className="w-11 h-11 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white hover:text-red-400 hover:border-red-500/40 transition-all active:scale-95 shadow-md"
          aria-label="Voltar para categorias"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {currentCategory?.name || 'Produtos'}
          </h2>
          <span className="text-xs text-neutral-400 font-medium">
            {categoryProducts.length} {categoryProducts.length === 1 ? 'opção deliciosa' : 'opções deliciosas'}
          </span>
        </div>
      </div>

      {/* Products List - 1 col on mobile, 2 cols on md/lg desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {categoryProducts.length === 0 ? (
          <div className="col-span-full text-center py-16 px-4 rounded-3xl bg-neutral-950 border border-neutral-900 text-neutral-400 text-base font-medium">
            Nenhum produto cadastrado nesta categoria no momento.
          </div>
        ) : (
          categoryProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProductForModal(product)}
              className="group bg-neutral-900/90 hover:bg-neutral-850 rounded-3xl p-3.5 sm:p-4 border border-neutral-800 hover:border-red-500/50 shadow-lg shadow-black/70 transition-all flex items-center gap-4 cursor-pointer active:scale-[0.98]"
            >
              {/* Product Thumbnail */}
              <div className="w-22 h-22 sm:w-26 sm:h-26 rounded-2xl bg-neutral-950 flex-shrink-0 overflow-hidden relative border border-white/10 shadow-md">
                <SiteImage
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white truncate group-hover:text-red-400 transition-colors">
                    {product.name}
                  </h3>
                  {product.isPopular && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-400 flex-shrink-0">
                      Popular
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-neutral-400 mt-1 line-clamp-2 leading-relaxed font-normal">
                  {product.description}
                </p>

                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-base sm:text-lg font-black text-white">
                    {formatBRL(product.price)}
                  </span>
                </div>
              </div>

              {/* Plus Button with Red Gradient */}
              <button
                type="button"
                onClick={(e) => handleQuickAdd(e, product)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-red-950/70 group-hover:scale-105 active:scale-95 transition-all flex-shrink-0 border border-red-500/40"
                aria-label="Adicionar ao carrinho"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};


