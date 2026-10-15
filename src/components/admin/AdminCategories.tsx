import { SiteImage } from '../SiteImage';
import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  X,
  Layers,
  Check,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Category } from '../../types';

export const AdminCategories: React.FC = () => {
  const {
    categories,
    products,
    siteId,
    saveCategoryAction,
    deleteCategoryAction,
  } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🍔');
  const [imageUrl, setImageUrl] = useState('');
  const [order, setOrder] = useState('1');
  const [isActive, setIsActive] = useState(true);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setIcon('🍔');
    setImageUrl('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80');
    setOrder((categories.length + 1).toString());
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setIcon(cat.icon || '🍔');
    setImageUrl(cat.imageUrl);
    setOrder(cat.order.toString());
    setIsActive(cat.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = editingCategory
      ? editingCategory.id
      : name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '-');

    const catData: Category = {
      id,
      siteId,
      name: name.trim(),
      icon: icon.trim() || '🍔',
      imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80',
      order: parseInt(order) || 1,
      isActive,
    };

    await saveCategoryAction(catData);
    setIsModalOpen(false);
  };

  const handleDelete = async (categoryId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      await deleteCategoryAction(categoryId);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    await saveCategoryAction({ ...cat, isActive: !cat.isActive });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Categorias do Cardápio
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Organize os quadrados de categorias exibidos na tela inicial do cliente.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-950/40 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Categories Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const prodsInCat = products.filter((p) => p.categoryId === cat.id);
          return (
            <div
              key={cat.id}
              className={`bg-neutral-900 rounded-3xl p-5 border flex flex-col justify-between transition-colors ${
                cat.isActive ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-800/40 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 flex-shrink-0">
                    <SiteImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{cat.icon}</span>
                      <h3 className="text-base font-bold text-white truncate">
                        {cat.name}
                      </h3>
                    </div>
                    <span className="text-xs text-neutral-400 block mt-1">
                      {prodsInCat.length} produto(s) cadastrado(s)
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                      Ordem: #{cat.order}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      cat.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    {cat.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 mt-4 border-t border-neutral-800 flex items-center justify-between">
                <button
                  onClick={() => handleToggleActive(cat)}
                  className="text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  {cat.isActive ? 'Desativar' : 'Ativar'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(cat)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                    title="Editar categoria"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Excluir categoria"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Adicionar / Editar Categoria */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-red-500" />
                <span>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-neutral-300 font-semibold block mb-1">
                    Nome da Categoria
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Lanches, Pizzas, Bebidas"
                    className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-neutral-300 font-semibold block mb-1">
                    Emoji / Ícone
                  </label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="🍔"
                    className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-center focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-neutral-300 font-semibold block mb-1">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    placeholder="1"
                    className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="catActiveCheck"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="catActiveCheck" className="text-neutral-300 font-semibold cursor-pointer">
                    Ativa no site
                  </label>
                </div>
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1">
                  URL da Imagem de Destaque
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

              {/* Preview */}
              {imageUrl && (
                <div className="w-full h-24 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800">
                  <SiteImage
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

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
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


