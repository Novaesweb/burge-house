import { SiteImage } from '../SiteImage';
import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Filter,
  Image as ImageIcon,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';

export const AdminProducts: React.FC = () => {
  const {
    products,
    categories,
    siteId,
    saveProductAction,
    deleteProductAction,
  } = useStore();

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories[0]?.id || 'lanches');
    setPrice('');
    setDescription('');
    setImageUrl('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategoryId(product.categoryId);
    setPrice(product.price.toString());
    setDescription(product.description);
    setImageUrl(product.imageUrl);
    setIsActive(product.isActive);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !categoryId) return;

    const prodData: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      siteId,
      categoryId,
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price.replace(',', '.')) || 0,
      imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80',
      isActive,
    };

    await saveProductAction(prodData);
    setIsModalOpen(false);
  };

  const handleToggleActive = async (product: Product) => {
    await saveProductAction({ ...product, isActive: !product.isActive });
  };

  const handleDelete = async (productId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto do cardápio?')) {
      await deleteProductAction(productId);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategoryFilter === 'todos' || p.categoryId === selectedCategoryFilter;
    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Catálogo de Produtos
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Cadastre, edite fotos, descrições, preços e disponibilidade dos itens do cardápio.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-950/40 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Produto</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 flex flex-col gap-3 items-stretch">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryFilter('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategoryFilter === 'todos'
                ? 'bg-red-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Todas as Categorias ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategoryFilter === cat.id
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-16 text-center text-neutral-500 bg-neutral-900 rounded-3xl border border-neutral-800">
            Nenhum produto cadastrado com os filtros atuais.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const category = categories.find((c) => c.id === product.categoryId);
            return (
              <div
                key={product.id}
                className={`bg-neutral-900 rounded-3xl p-4 border transition-all flex flex-col justify-between ${
                  product.isActive
                    ? 'border-neutral-800 hover:border-neutral-700'
                    : 'border-neutral-800/50 opacity-60 bg-neutral-950'
                }`}
              >
                <div>
                  {/* Photo & Badge */}
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-neutral-950 mb-3 border border-neutral-800">
                    <SiteImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                      {category?.name || product.categoryId}
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          product.isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {product.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-white leading-tight">
                        {product.name}
                      </h3>
                      <span className="text-base font-black text-red-500 whitespace-nowrap">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 mt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleActive(product)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      product.isActive
                        ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30'
                    }`}
                  >
                    {product.isActive ? 'Desativar' : 'Ativar no Cardápio'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(product)}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                      title="Editar produto"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir produto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Adicionar / Editar Produto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-red-500" />
                <span>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="text-neutral-300 font-semibold block mb-1">
                  Nome do Produto
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: X-Burguer Especial"
                  className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-300 font-semibold block mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-neutral-300 font-semibold block mb-1">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="18.90"
                    className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1">
                  Descrição Curta (Ingredientes / Detalhes)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Pão artesanal brioche, blend 180g, queijo cheddar derretido, cebola caramelizada e maionese da casa."
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1">
                  URL da Foto do Produto
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              {/* Photo Preview */}
              {imageUrl && (
                <div className="w-full h-32 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 relative">
                  <SiteImage
                    src={imageUrl}
                    alt="Pré-visualização"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as any).src =
                        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="isActiveCheck" className="text-neutral-300 font-semibold cursor-pointer">
                  Disponível para venda imediata no site
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-950/40"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};



