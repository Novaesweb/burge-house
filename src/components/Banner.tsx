import React from 'react';
import { ArrowUpRight, Clock3, Sparkles } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SiteImage } from './SiteImage';

export const Banner: React.FC = () => {
  const { siteSettings, setCustomerView } = useStore();
  return (
    <section className="store-hero">
      <div className="hero-copy">
        <span className="hero-eyebrow"><Sparkles size={14} /> FEITO NA HORA. FEITO PRA VOCÊ.</span>
        <h2>Seu próximo<br />favorito está <em>aqui.</em></h2>
        <p>Ingredientes caprichados, combinações irresistíveis e aquele sabor que dá vontade de repetir.</p>
        <button type="button" onClick={() => setCustomerView('categories')} className="hero-cta">Explorar o cardápio <ArrowUpRight size={18} /></button>
        <span className="hero-note"><Clock3 size={14} /> {siteSettings.openingHours}</span>
      </div>
      <div className="hero-photo">
        <SiteImage src={siteSettings.bannerUrl} alt="Hambúrguer artesanal com queijo, salada e pão tostado" fetchPriority="high" />
        <div className="hero-photo-label"><span>O sabor da casa</span><strong>Artesanal de verdade.</strong></div>
      </div>
    </section>
  );
};

