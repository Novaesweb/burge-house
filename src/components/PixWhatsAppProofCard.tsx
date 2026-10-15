import React, { useState } from 'react';
import {
  QrCode,
  Copy,
  Check,
  MessageCircle,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order } from '../types';
import { formatBRL } from '../utils/formatters';

interface PixWhatsAppProofCardProps {
  order: Order;
  compact?: boolean;
}

export const PixWhatsAppProofCard: React.FC<PixWhatsAppProofCardProps> = ({
  order,
  compact = false,
}) => {
  const { siteSettings } = useStore();
  const [copied, setCopied] = useState(false);

  const pixKey =
    siteSettings?.pixKey ||
    siteSettings?.phone ||
    '11987654321';

  const storePhone = siteSettings?.phone || '(11) 98765-4321';
  const cleanStorePhone = storePhone.replace(/\D/g, '');

  const whatsappMessage = `Olá! Sou o(a) ${order.customerName}, acabei de fazer o Pedido #${order.orderNumber} no valor de ${formatBRL(order.total)}. Segue meu comprovante PIX em anexo!`;
  const whatsappUrl = `https://wa.me/55${cleanStorePhone}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  const handleCopyKey = () => {
    try {
      navigator.clipboard.writeText(pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="rounded-3xl bg-gradient-to-b from-purple-950/70 via-neutral-900 to-neutral-900 border-2 border-purple-500/60 p-5 shadow-2xl text-left space-y-4 my-4 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-purple-500/30">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-600/30 border border-purple-500 flex items-center justify-center text-purple-300 flex-shrink-0 shadow-lg shadow-purple-950">
            <QrCode className="w-6 h-6 text-purple-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                PIX Pendente
              </span>
              <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" /> Aguarda Comprovante
              </span>
            </div>
            <h3 className="text-base font-black text-white mt-1">
              Pague via PIX e envie o comprovante
            </h3>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <span className="text-[10px] text-neutral-400 font-bold uppercase block">
            Total a Pagar
          </span>
          <span className="text-lg font-black text-emerald-400">
            {formatBRL(order.total)}
          </span>
        </div>
      </div>

      {/* Chave PIX Copy Box */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-neutral-300 flex items-center justify-between">
          <span>Chave PIX da Loja:</span>
          <span className="text-[11px] text-purple-300 font-semibold">
            {siteSettings?.pixKeyType ? `Tipo: ${siteSettings.pixKeyType.toUpperCase()}` : 'Chave Copia e Cola'}
          </span>
        </label>

        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 rounded-2xl bg-black/80 border border-neutral-800 text-xs font-mono font-bold text-purple-200 truncate select-all">
            {pixKey}
          </div>
          <button
            type="button"
            onClick={handleCopyKey}
            className={`px-4 py-3 rounded-2xl font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2-Step Instruction Notice */}
      <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20 text-xs text-neutral-300 space-y-1">
        <p className="flex items-start gap-1.5 text-neutral-300">
          <span className="font-black text-purple-400">1.</span>
          <span>Copie a chave acima e faça o pagamento no aplicativo do seu banco.</span>
        </p>
        <p className="flex items-start gap-1.5 text-neutral-300">
          <span className="font-black text-purple-400">2.</span>
          <span>Clique no botão verde abaixo para enviar o comprovante no WhatsApp do restaurante para validação.</span>
        </p>
      </div>

      {/* THE REQUESTED PROMINENT WHATSAPP PROOF BUTTON */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-sm shadow-xl shadow-emerald-950/80 active:scale-98 transition-all flex items-center justify-center gap-2.5 group"
      >
        <MessageCircle className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
        <span className="tracking-tight">📲 Enviar Comprovante no WhatsApp</span>
        <ExternalLink className="w-4 h-4 opacity-70" />
      </a>
    </div>
  );
};


