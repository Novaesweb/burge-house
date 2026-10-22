import React from 'react';
import { Clock, Phone, MapPin } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import burgerHouseLogo from '../assets/brand/burger-house-logo.png';
import { whatsappNumber } from '../utils/adminOrders';

export const Footer: React.FC = () => {
  const { siteSettings } = useStore();

  return (
    <footer className="mt-8 pt-6 pb-6 border-t border-neutral-900 bg-black text-neutral-300">
      {/* Store information */}
      <div className="space-y-3.5 px-1">
        {/* Brand line with subtle gradient */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 p-px shadow-md shadow-red-950/50">
              <img src={burgerHouseLogo} alt="" className="w-full h-full object-cover object-top scale-125 rounded-[10px]" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white tracking-tight leading-none">
                {siteSettings.name}
              </h4>
              <span className="text-[10px] text-red-500 font-semibold tracking-wide">
                DEMONSTRAÇÃO NOVAESWEB
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/60 border border-red-800/40 text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {siteSettings.isOpen ? 'Aberto Hoje' : 'Fechado'}
          </span>
        </div>

        {/* Clean, direct contact & hours details */}
        <div className="space-y-1.5 text-[11px] text-neutral-400 font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="text-neutral-300">{siteSettings.openingHours || '10:00 às 23:00'}</span>
          </div>
          {siteSettings.phone && <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="text-neutral-300">{siteSettings.phone}</span>
          </div>}
          {siteSettings.address && <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="text-neutral-400 truncate">{siteSettings.address}</span>
          </div>}
        </div>

        <nav aria-label="Informações legais" className="flex flex-wrap justify-center gap-4 border-t border-neutral-900 pt-4 text-xs font-semibold">
          <a href="#/privacidade" className="text-neutral-300 hover:text-red-400 underline-offset-4 hover:underline">Política de Privacidade</a>
          <a href="#/termos" className="text-neutral-300 hover:text-red-400 underline-offset-4 hover:underline">Termos de Uso</a>
          {siteSettings.phone && <a href={`https://wa.me/${whatsappNumber(siteSettings.phone)}`} target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-red-400">Contato</a>}
        </nav>
        <p className="text-center text-[11px] text-amber-300/90">Loja fictícia de demonstração. Não realiza vendas nem entregas reais.</p>
        {/* Bottom Credits */}
        <div className="pt-3 mt-3 border-t border-neutral-900/80 flex items-center justify-between gap-2 text-[11px]">
          <div className="text-neutral-400 flex items-center gap-1 font-medium">
            <span>Criado por</span>
            <span className="bg-gradient-to-r from-red-500 via-rose-400 to-amber-400 bg-clip-text text-transparent font-extrabold tracking-tight">
              Novaesweb
            </span>
          </div>

          <span className="text-[10px] text-neutral-500">
            Todos os direitos reservados
          </span>
        </div>

        {/* Administrative Quick Switchers */}
        <div className="pt-2 flex items-center justify-center gap-4 text-[10px] text-neutral-600">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/admdono';
              window.dispatchEvent(new Event('hashchange'));
            }}
            className="hover:text-neutral-300 transition-colors cursor-pointer"
          >
            Painel do Dono (/admdono)
          </button>
        </div>
      </div>
    </footer>
  );
};


