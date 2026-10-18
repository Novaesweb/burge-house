import React from 'react';
import { Printer, X, Check, Clock, Phone, MapPin, Receipt, Flame } from 'lucide-react';
import { Order, SiteSettings } from '../../types';

interface OrderReceiptModalProps {
  order: Order | null;
  settings: SiteSettings;
  onClose: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  settings,
  onClose,
}) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(order.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const paymentLabels: Record<string, string> = {
    pix: 'PIX (Online/Na Entrega)',
    credit_card: 'Cartão (Débito/Crédito na Máquina)',
    cash: 'Dinheiro',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title" className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl relative my-auto">
        {/* Controls - Hidden during print */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-red-500" />
            <h3 id="receipt-dialog-title" className="text-base font-black text-white">Comanda de Impressão</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-950/60 hover:from-red-500 hover:to-rose-500 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Fechar comanda"
              className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE THERMAL RECEIPT AREA (Styled like standard 80mm/58mm thermal slips) */}
        <div
          id="thermal-receipt"
          className="bg-white text-black p-5 rounded-2xl font-mono text-xs shadow-inner select-all leading-snug print:p-0 print:m-0 print:shadow-none"
        >
          {/* Header */}
          <div className="text-center pb-2 border-b-2 border-dashed border-neutral-300">
            <h2 className="text-base font-extrabold tracking-tight uppercase">
              {settings.name}
            </h2>
            <p className="text-[10px] text-neutral-600 mt-0.5">{settings.address}</p>
            <p className="text-[10px] text-neutral-600">Tel: {settings.phone || 'Não informado'}</p>
            <div className="mt-1 text-[11px] font-bold">
              PEDIDO #{order.id.slice(-5).toUpperCase()}
            </div>
            <div className="text-[10px] text-neutral-500">{formattedDate}</div>
          </div>

          {/* Customer Info */}
          <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-0.5">
            <div className="font-bold text-xs uppercase">Cliente: {order.customerName}</div>
            <div className="text-[11px]">Tel: {order.customerPhone}</div>
            <div className="text-[11px] font-semibold">
              Endereço: {order.deliveryAddress.street}, {order.deliveryAddress.number}
              {order.deliveryAddress.complement && ` - ${order.deliveryAddress.complement}`}
            </div>
            <div className="text-[11px]">Bairro: {order.deliveryAddress.neighborhood}</div>
          </div>

          {/* Items Table */}
          <div className="py-2.5 border-b-2 border-dashed border-neutral-300">
            <div className="flex justify-between font-bold text-[11px] pb-1 uppercase border-b border-neutral-200 mb-1.5">
              <span>Qtd Item</span>
              <span>Total</span>
            </div>
            <div className="space-y-1.5">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="pb-1 border-b border-neutral-100 last:border-0">
                  <div className="flex justify-between items-baseline font-bold text-[11px]">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span>
                      R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  {item.meatPoint && (
                    <div className="text-[10px] font-bold text-neutral-800 pl-3">
                      🥩 Ponto: {item.meatPoint}
                    </div>
                  )}
                  {item.selectedAddons && item.selectedAddons.length > 0 && (
                    <div className="text-[10px] text-neutral-700 pl-3 font-medium">
                      ➕ {item.selectedAddons.map((a) => a.name).join(', ')}
                    </div>
                  )}
                  {item.removals && item.removals.length > 0 && (
                    <div className="text-[10px] font-bold text-neutral-800 pl-3">
                      ❌ Sem: {item.removals.join(', ')}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-[10px] text-neutral-600 italic pl-3">
                      Obs: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="py-2.5 border-b-2 border-dashed border-neutral-300 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span>Subtotal:</span>
              <span>R$ {order.subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Taxa de Entrega:</span>
              <span>R$ {order.deliveryFee.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-neutral-200">
              <span>TOTAL A PAGAR:</span>
              <span>R$ {order.total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          {/* Payment & Observations */}
          <div className="pt-2 text-[10px] space-y-1">
            <div>
              <span className="font-bold">Forma de Pagamento: </span>
              <span>{paymentLabels[order.paymentMethod] || order.paymentMethod}</span>
            </div>
            {order.paymentChange && (
              <div className="font-bold text-red-600">
                Troco solicitado para: R$ {order.paymentChange}
              </div>
            )}
            {order.notes && (
              <div className="mt-1 p-1 bg-neutral-100 rounded text-[10px] font-bold">
                OBS: {order.notes}
              </div>
            )}
            <div className="text-center pt-3 text-[9px] text-neutral-500 uppercase tracking-widest">
              Obrigado pela preferência!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


