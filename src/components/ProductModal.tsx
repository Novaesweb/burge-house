import { SiteImage } from './SiteImage';
import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  Flame,
  Check,
  PlusCircle,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SelectedAddon } from '../types';
import { formatBRL } from '../utils/formatters';

const DEFAULT_ADDONS: SelectedAddon[] = [
  { id: 'add-bacon', name: 'Bacon Crocante', price: 5.0 },
  { id: 'add-cheddar', name: 'Dobro de Queijo Cheddar', price: 5.0 },
  { id: 'add-burger-extra', name: 'Hambúrguer Extra 160g', price: 8.0 },
  { id: 'add-molho', name: 'Molho Especial da Casa', price: 3.0 },
  { id: 'add-cebola-caram', name: 'Cebola Caramelizada', price: 4.0 },
  { id: 'add-ovo', name: 'Ovo Frito na Chapa', price: 3.0 },
];

const MEAT_POINTS = [
  { id: 'ao-ponto', label: 'Ao Ponto', desc: 'Vermelhinha e bem suculenta' },
  { id: 'bem-passado', label: 'Bem Passado', desc: 'Mais tostada e firme' },
  { id: 'mal-passado', label: 'Mal Passado', desc: 'Selada no fogo alto' },
];

const REMOVABLE_ITEMS = [
  'Sem Cebola',
  'Sem Picles',
  'Sem Tomate',
  'Sem Alface',
  'Sem Maionese',
];

export const ProductModal: React.FC = () => {
  const { selectedProductForModal, setSelectedProductForModal, addToCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedMeatPoint, setSelectedMeatPoint] = useState<string>('Ao Ponto');
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>([]);

  if (!selectedProductForModal) return null;

  const product = selectedProductForModal;
  const isBurger =
    product.categoryId?.includes('burg') ||
    product.name?.toLowerCase().includes('burger') ||
    product.name?.toLowerCase().includes('hambúrguer') ||
    product.name?.toLowerCase().includes('lanche');

  const basePrice = typeof product.price === 'number' ? product.price : 0;
  const addonsTotal = selectedAddons.reduce((acc, item) => acc + (item.price || 0), 0);
  const unitPriceWithAddons = basePrice + addonsTotal;
  const grandTotal = unitPriceWithAddons * quantity;

  const toggleAddon = (addon: SelectedAddon) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      }
      return [...prev, addon];
    });
  };

  const toggleRemoval = (item: string) => {
    setSelectedRemovals((prev) => {
      if (prev.includes(item)) {
        return prev.filter((r) => r !== item);
      }
      return [...prev, item];
    });
  };

  const handleAdd = () => {
    addToCart(product, quantity, notes.trim(), {
      meatPoint: isBurger ? selectedMeatPoint : undefined,
      removals: selectedRemovals.length > 0 ? selectedRemovals : undefined,
      selectedAddons: selectedAddons.length > 0 ? selectedAddons : undefined,
    });

    // Reset state & close
    setSelectedProductForModal(null);
    setQuantity(1);
    setNotes('');
    setSelectedAddons([]);
    setSelectedRemovals([]);
    setSelectedMeatPoint('Ao Ponto');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-neutral-950 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Product Image Header */}
        <div className="relative h-56 sm:h-60 w-full bg-black flex items-center justify-center overflow-hidden flex-shrink-0">
          <SiteImage
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-black/70" />

          {/* Close button */}
          <button
            onClick={() => setSelectedProductForModal(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-2xl bg-black/80 border border-white/15 text-white flex items-center justify-center hover:bg-black transition-all active:scale-90 shadow-xl"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Customization Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 divide-y divide-neutral-850">
          {/* Main Info */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                {product.name}
              </h3>
              <div className="text-xl font-black text-red-500 whitespace-nowrap">
                {formatBRL(basePrice)}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-normal">
              {product.description}
            </p>
          </div>

          {/* 1. Ponto da Carne (if burger) */}
          {isBurger && (
            <div className="pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>Ponto da Carne</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                  Obrigatório
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {MEAT_POINTS.map((mp) => {
                  const isSelected = selectedMeatPoint === mp.label;
                  return (
                    <button
                      key={mp.id}
                      type="button"
                      onClick={() => setSelectedMeatPoint(mp.label)}
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        isSelected
                          ? 'bg-red-600/20 border-red-500 text-white ring-1 ring-red-500 shadow-md'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-black block">{mp.label}</span>
                      <span className="text-[10px] text-neutral-400 block mt-0.5 line-clamp-1">
                        {mp.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Adicionais Deliciosos (Custom Extras) */}
          <div className="pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Adicionais Deliciosos</span>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                Opcional
              </span>
            </div>

            <div className="space-y-2">
              {DEFAULT_ADDONS.map((addon) => {
                const isSelected = selectedAddons.some((a) => a.id === addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/80 text-white'
                        : 'bg-neutral-900/90 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'border border-neutral-700 bg-neutral-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-xs sm:text-sm font-bold">{addon.name}</span>
                    </div>

                    <span className="text-xs sm:text-sm font-black text-emerald-400">
                      +{formatBRL(addon.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Remover Ingredientes */}
          <div className="pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed className="w-4 h-4 text-neutral-400" />
                <span>Remover Ingredientes</span>
              </span>
              <span className="text-[11px] font-bold text-neutral-500">Sem custo</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {REMOVABLE_ITEMS.map((item) => {
                const isRemoved = selectedRemovals.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleRemoval(item)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isRemoved
                        ? 'bg-red-950 border-red-500/80 text-red-400 line-through'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Observações */}
          <div className="pt-4 space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 block uppercase tracking-wider">
              Outras Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Maionese à parte, caprichar no guardanapo..."
              rows={2}
              className="w-full text-sm rounded-2xl border border-neutral-800 bg-neutral-900/90 p-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-red-500 font-medium resize-none"
            />
          </div>

          {/* 5. Quantidade Stepper */}
          <div className="pt-4 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Quantidade:</span>
            <div className="flex items-center gap-3 bg-neutral-900 px-3 py-1.5 rounded-2xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-xl bg-neutral-800 text-white flex items-center justify-center active:scale-90 font-bold"
                aria-label="Diminuir quantidade"
              >
                <Minus className="w-4 h-4 stroke-[3]" />
              </button>
              <span className="text-base font-black w-6 text-center text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center active:scale-90 font-bold shadow-md shadow-red-950"
                aria-label="Aumentar quantidade"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Add to Cart Button with Live Dynamic Price */}
        <div className="p-4 bg-neutral-900 border-t border-neutral-800 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleAdd}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-base shadow-xl shadow-red-950/80 active:scale-98 transition-all flex items-center justify-between px-5"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>Adicionar ao Pedido</span>
            </div>
            <span className="text-lg font-black">{formatBRL(grandTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


