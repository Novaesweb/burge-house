import React from 'react';
import { ENGINE_VERSION } from '../config/platform';

export function PlatformSignature({ storeName }: { storeName: string }) {
  return <div className="novaesweb-institutional-footer">
    <div className="novaesweb-footer-signature">
      <span>Feito com <span className="novaesweb-heart" role="img" aria-label="amor">❤️</span> por </span>
      <a href="https://novaesweb.com.br" target="_blank" rel="noopener noreferrer" className="novaesweb-brand-link">NovaesWeb</a>
    </div>
    <p className="novaesweb-copyright">© {new Date().getFullYear()} {storeName}. Todos os direitos reservados. • <strong>v{ENGINE_VERSION}</strong></p>
  </div>;
}

export function PlatformVersionBadge() {
  return <div className="novaesweb-version-badge" title={`NovaesWeb Commerce Engine — Versão ${ENGINE_VERSION}`}>
    <span className="status-dot-green" aria-hidden="true">●</span>
    <span>v{ENGINE_VERSION} • Sistema Atualizado</span>
  </div>;
}
