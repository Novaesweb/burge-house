import React from 'react';
import { Clock3, Megaphone, Sparkles, Wrench } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { PlatformSignature } from './PlatformSignature';

export const SiteSuspendedScreen: React.FC = () => {
  const { siteSettings, storeAvailability } = useStore();
  const status = storeAvailability.status || siteSettings.status;
  const statusLabel = status === 'maintenance'
    ? 'Em manutenção'
    : status === 'pending' || status === 'pending_payment'
      ? 'Aguardando ativação'
      : status === 'inactive' || status === 'unavailable' || status === 'checking'
        ? 'Temporariamente indisponível'
        : 'Acesso temporariamente suspenso';
  const message = storeAvailability.message?.trim()
    || 'Estamos fazendo alguns ajustes para atender você melhor. Tente novamente mais tarde.';
  const returnAt = storeAvailability.returnAt ? new Date(storeAvailability.returnAt) : null;
  const hasReturnAt = Boolean(returnAt && !Number.isNaN(returnAt.getTime()));
  const formattedReturn = hasReturnAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone:'America/Sao_Paulo' }).format(returnAt!)
    : null;

  return (
    <main className="novaesweb-blocked-page">
      <div className="novaesweb-blocked-grid" aria-hidden="true" />
      <div className="novaesweb-blocked-content">
        <header className="novaesweb-brand" aria-label="NovaesWeb">
          <div className="novaesweb-brand-orbit"><span>N</span><i>N</i></div>
          <strong>NovaesWeb</strong>
        </header>

        <section className="novaesweb-blocked-card" aria-labelledby="blocked-title">
          <span className="novaesweb-status-badge"><Wrench size={16} /> {statusLabel}</span>
          <h1 id="blocked-title">Voltamos em breve</h1>
          <p className="novaesweb-blocked-lead">Esta loja está temporariamente indisponível.</p>

          <div className="novaesweb-message-box">
            <Megaphone aria-hidden="true" />
            <div>
              <p>Comunicado da loja</p>
              <span>{message}</span>
            </div>
          </div>

          {hasReturnAt && (
            <div className="novaesweb-return-box">
              <Clock3 aria-hidden="true" />
              <div>
                <p>Previsão de retorno</p>
                <span>{formattedReturn}</span>
              </div>
            </div>
          )}
        </section>

        <footer><div className="novaesweb-blocked-footer"><Sparkles size={14} /> NovaesWeb Connect · Acesso seguro</div><div className="mt-5"><PlatformSignature storeName={siteSettings.name}/></div></footer>
      </div>
    </main>
  );
};


