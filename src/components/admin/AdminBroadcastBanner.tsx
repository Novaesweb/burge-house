import React, { useState, useEffect } from 'react';
import {
  Radio,
  X,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Volume2,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { MasterBroadcast } from '../../types';
import {
  MASTER_CANONICAL_SITE_ID,
  MASTER_IDENTIFIER_NX_ID,
  subscribeMasterBroadcast,
  isBroadcastDismissed,
  dismissBroadcast,
  clearBroadcastDismissal,
} from '../../services/broadcastService';

interface AdminBroadcastBannerProps {
  siteId?: string;
}

export const AdminBroadcastBanner: React.FC<AdminBroadcastBannerProps> = ({
  siteId = MASTER_CANONICAL_SITE_ID,
}) => {
  const [broadcast, setBroadcast] = useState<MasterBroadcast | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState<boolean>(false);

  useEffect(() => {
    const targetSiteId = siteId || MASTER_CANONICAL_SITE_ID;

    // Listen to real-time broadcasts
    const unsubscribe = subscribeMasterBroadcast(targetSiteId, (newBroadcast) => {
      setBroadcast(newBroadcast);
      if (newBroadcast) {
        const dismissed = isBroadcastDismissed(newBroadcast.id);
        setIsDismissed(dismissed);
      } else {
        setIsDismissed(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [siteId]);

  if (!broadcast || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      if (broadcast) {
        dismissBroadcast(broadcast.id);
      }
      setIsDismissed(true);
      setIsAnimatingOut(false);
    }, 250);
  };

  const priority = (broadcast.priority || 'info').toLowerCase();

  // Palette based on message urgency
  const getTheme = () => {
    switch (priority) {
      case 'urgent':
      case 'alert':
      case 'danger':
        return {
          bannerBg: 'bg-gradient-to-r from-red-950/90 via-red-900/80 to-neutral-950',
          borderColor: 'border-red-600/70',
          textColor: 'text-red-100',
          badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
          iconColor: 'text-red-400',
          glow: 'shadow-[0_4px_24px_-4px_rgba(239,68,68,0.35)]',
          icon: <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse flex-shrink-0" />,
        };
      case 'warning':
        return {
          bannerBg: 'bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-neutral-950',
          borderColor: 'border-amber-500/70',
          textColor: 'text-amber-100',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          iconColor: 'text-amber-400',
          glow: 'shadow-[0_4px_24px_-4px_rgba(245,158,11,0.3)]',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
        };
      case 'success':
        return {
          bannerBg: 'bg-gradient-to-r from-emerald-950/90 via-emerald-900/80 to-neutral-950',
          borderColor: 'border-emerald-500/70',
          textColor: 'text-emerald-100',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          iconColor: 'text-emerald-400',
          glow: 'shadow-[0_4px_24px_-4px_rgba(16,185,129,0.3)]',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
        };
      case 'info':
      default:
        return {
          bannerBg: 'bg-gradient-to-r from-indigo-950/90 via-neutral-900/90 to-neutral-950',
          borderColor: 'border-indigo-500/60',
          textColor: 'text-indigo-100',
          badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          iconColor: 'text-indigo-400',
          glow: 'shadow-[0_4px_24px_-4px_rgba(99,102,241,0.3)]',
          icon: <Radio className="w-5 h-5 text-indigo-400 animate-pulse flex-shrink-0" />,
        };
    }
  };

  const theme = getTheme();
  const isLongMessage = broadcast.message.length > 160;

  return (
    <>
      <aside
        role="alert"
        aria-live="polite"
        className={`w-full border-b transition-all duration-300 z-30 ${theme.bannerBg} ${theme.borderColor} ${theme.glow} ${
          isAnimatingOut ? 'opacity-0 -translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 md:gap-4">
            {/* Left: Source Badge + Icon + Content */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="p-1.5 rounded-xl bg-black/40 border border-white/10 mt-0.5 md:mt-0 flex-shrink-0">
                {theme.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${theme.badgeBg}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    COMUNICADO MASTER
                  </span>

                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-[10px] font-mono text-neutral-300">
                    ID: {MASTER_IDENTIFIER_NX_ID}
                  </span>

                  {broadcast.createdAt && (
                    <span className="text-[10px] text-neutral-400 hidden sm:inline">
                      {new Date(broadcast.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                <div className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{broadcast.title}</span>
                </div>

                <p className={`text-xs text-neutral-300 line-clamp-2 md:line-clamp-1 mt-0.5 leading-relaxed`}>
                  {broadcast.message}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0 pt-1 md:pt-0">
              {isLongMessage && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Ler Completo</span>
                </button>
              )}

              {broadcast.actionUrl && (
                <a
                  href={broadcast.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <span>{broadcast.actionText || 'Acessar'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <button
                type="button"
                onClick={handleDismiss}
                className="p-1.5 rounded-lg bg-black/40 hover:bg-black/70 text-neutral-400 hover:text-white transition-colors border border-white/10 flex items-center gap-1 text-xs font-medium cursor-pointer"
                title="Fechar comunicado (salvar como lido)"
                aria-label="Fechar comunicado"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px] pr-1">Fechar</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Full Modal Dialog when expanding long broadcasts */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase border ${theme.badgeBg}`}>
                COMUNICADO MASTER ({MASTER_IDENTIFIER_NX_ID})
              </span>
              <span className="text-xs text-neutral-400">
                Loja: {MASTER_CANONICAL_SITE_ID}
              </span>
            </div>

            <h3 className="text-lg font-black text-white mb-3">
              {broadcast.title}
            </h3>

            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mb-5 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-neutral-200 whitespace-pre-line leading-relaxed">
                {broadcast.message}
              </p>
            </div>

            {broadcast.createdAt && (
              <p className="text-[11px] text-neutral-500 mb-4">
                Transmitido em: {new Date(broadcast.createdAt).toLocaleString('pt-BR')}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              {broadcast.actionUrl && (
                <a
                  href={broadcast.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <span>{broadcast.actionText || 'Acessar Link'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  handleDismiss();
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs"
              >
                Marcar como Lido e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


