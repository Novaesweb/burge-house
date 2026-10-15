import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SiteImage } from './SiteImage';
export const CategorySquares: React.FC<{ isGridView?: boolean }> = () => {
  const { categories, products, selectedCategoryId, setSelectedCategoryId, setCustomerView } = useStore();
  return <div className="category-grid">
    {categories.filter(category => category.isActive !== false).sort((a,b) => a.order - b.order).map(category => {
      const count = products.filter(product => product.categoryId === category.id && product.isActive !== false).length;
      return <button type="button" key={category.id} className={`category-card ${selectedCategoryId === category.id ? 'selected' : ''}`} onClick={() => { setSelectedCategoryId(category.id); setCustomerView('products'); }}>
        <div className="category-photo"><SiteImage src={category.imageUrl} alt={category.name} loading="lazy" /><span className="category-arrow"><ArrowUpRight size={18} /></span></div>
        <div className="category-details"><strong>{category.name}</strong><span>{count > 0 ? `${count} ${count === 1 ? 'opção no cardápio' : 'opções no cardápio'}` : 'Novidades em breve'}</span></div>
      </button>;
    })}
  </div>;
};

