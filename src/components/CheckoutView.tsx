import { requireSupabase } from '../lib/supabase';
import { isWithinOpeningHours } from '../utils/openingHours';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  QrCode,
  CreditCard,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { isRemoteStore } from '../services/storeService';
import { PaymentMethod } from '../types';
import { formatBRL } from '../utils/formatters';

export const CheckoutView: React.FC = () => {
  const {
    siteId,
    cartSubtotal,
    cartTotal,
    siteSettings,
    handleCheckoutOrder,
    setCustomerView,
  } = useStore();

  const customerKey = (phoneNumber: string) => `delivery:customer:${siteId}:${phoneNumber.replace(/\D/g,'')}`;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(() => localStorage.getItem(`delivery:customer-phone:${siteId}`) || '');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id=window.setInterval(()=>setNow(new Date()),30000);return()=>window.clearInterval(id); }, []);
  const scheduleOpen = isWithinOpeningHours(siteSettings, now);
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponFeedback, setCouponFeedback] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const couponRequestId = useRef(0);
  const [cep, setCep] = useState('');
  const [cepMessage, setCepMessage] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  useEffect(() => {
    const digits=phone.replace(/\D/g,'');
    if (digits.length < 10) return;
    const saved=localStorage.getItem(customerKey(digits));
    if (!saved) return;
    try {
      const data=JSON.parse(saved);
      setName(data.name || '');
      setCep(data.cep || '');
      setStreet(data.street || '');
      setNumber(data.number || '');
      setComplement(data.complement || '');
      setNeighborhood(data.neighborhood || '');
    } catch { /* Dados locais inválidos: manter preenchimento manual. */ }
  }, [phone, siteId]);
  const [isEditingAddress, setIsEditingAddress] = useState(() => !localStorage.getItem('customer_saved_street'));

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentChange, setPaymentChange] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const acceptedMethods = useMemo(() => (siteSettings.acceptedPaymentMethods || []).filter((method) =>
    method !== 'pix' || Boolean(siteSettings.pixKey?.trim())
  ), [siteSettings.acceptedPaymentMethods, siteSettings.pixKey]);

  useEffect(() => {
    if (!acceptedMethods.includes(paymentMethod)) setPaymentMethod(acceptedMethods[0] || 'cash');
  }, [acceptedMethods, paymentMethod]);

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8) { setCepMessage('Informe um CEP com 8 dígitos.'); return; }
    setCepLoading(true);
    setCepMessage('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error('Consulta indisponível');
      const data = await response.json();
      if (data.erro) { setCepMessage('CEP não encontrado. Digite o endereço manualmente.'); return; }
      if (data.logradouro) setStreet(data.logradouro);
      if (data.bairro) setNeighborhood(data.bairro);
      setIsEditingAddress(true);
      setCepMessage(`Endereço encontrado: ${data.localidade || ''} / ${data.uf || ''}. Confira os dados.`);
    } catch {
      setCepMessage('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    } finally { setCepLoading(false); }
  };

  const checkCoupon = async () => {
    const requestId = ++couponRequestId.current;
    setCouponLoading(true); setCouponFeedback('');
    try {
      const code = couponInput.trim().toUpperCase();
      if (!code) { setCouponCode(''); setCouponDiscount(0); return; }
      const {data,error} = await requireSupabase().rpc('delivery_quote_coupon', {
        p_store_id: siteId, p_code: code, p_subtotal: cartSubtotal
      });
      if (requestId !== couponRequestId.current) return;
      if (error || !data?.valid) { setCouponCode(''); setCouponDiscount(0); setCouponFeedback('Cupom inválido, expirado ou indisponível para este pedido.'); return; }
      setCouponCode(code); setCouponDiscount(Number(data.discount)||0);
      setCouponFeedback('Cupom aplicado! O valor final será confirmado pelo servidor.');
    } catch { if (requestId === couponRequestId.current) { setCouponCode(''); setCouponDiscount(0); setCouponFeedback('Não foi possível verificar o cupom.'); } }
    finally { if (requestId === couponRequestId.current) setCouponLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleOpen) { setErrorMsg('A loja está fechada neste horário. Volte durante o funcionamento.'); return; }
    if (!name.trim()) {
      setErrorMsg('Por favor informe seu nome.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Por favor informe seu telefone.');
      return;
    }
    if (!street.trim() || !number.trim() || !neighborhood.trim()) {
      setErrorMsg('Por favor complete os dados do endereço de entrega.');
      return;
    }
    if (!acceptedMethods.includes(paymentMethod)) {
      setErrorMsg('Escolha uma forma de pagamento disponível.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      await handleCheckoutOrder({
        customerName: name,
        customerPhone: phone,
        deliveryAddress: {
          street,
          number,
          complement,
          neighborhood,
        },
        paymentMethod,
        couponCode: couponCode || undefined,
        paymentChange: paymentMethod === 'cash' ? paymentChange : undefined,
        notes,
      });
      localStorage.setItem(customerKey(phone),JSON.stringify({name:name.trim(),cep,street:street.trim(),number:number.trim(),complement:complement.trim(),neighborhood:neighborhood.trim()}));
      localStorage.setItem(`delivery:customer-phone:${siteId}`,phone.replace(/\D/g,''));
    } catch (err: any) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível confirmar o pedido. Tente novamente.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => { ++couponRequestId.current; setCouponCode(''); setCouponDiscount(0); setCouponFeedback(''); setCouponLoading(false); }, [cartSubtotal]);
  const deliveryFee = typeof siteSettings?.deliveryFee === 'number' ? siteSettings.deliveryFee : 5.0;

  return (
    <div className="pb-12 px-1">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 mb-4 border-b border-neutral-850">
        <button
          onClick={() => setCustomerView('cart')}
          className="w-11 h-11 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white hover:bg-neutral-800 active:scale-95 transition-all shadow-md"
          aria-label="Voltar para o carrinho"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Finalizar Pedido
          </h2>
          <p className="text-xs text-neutral-400 font-medium">
            {isRemoteStore(siteId) ? 'Preencha seus dados para entrega.' : 'A loja ainda está em preparação. Pedidos estarão disponíveis após a aprovação do cadastro.'}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-400 text-sm font-bold flex items-center gap-2">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Seus dados */}
          <div className="space-y-3">
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>1. Seus Dados</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Name */}
              <div className="flex items-center gap-3 bg-neutral-900/90 p-3.5 rounded-2xl border border-neutral-800 focus-within:border-red-500 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-red-500 flex-shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-bold text-neutral-400 block uppercase tracking-wider mb-0.5">
                    Seu Nome Completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full text-base font-semibold bg-transparent text-white placeholder-neutral-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3 bg-neutral-900/90 p-3.5 rounded-2xl border border-neutral-800 focus-within:border-red-500 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-red-500 flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-bold text-neutral-400 block uppercase tracking-wider mb-0.5">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full text-base font-semibold bg-transparent text-white placeholder-neutral-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Endereço de Entrega */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>2. Endereço de Entrega</span>
              </h3>

              <button
                type="button"
                onClick={() => setIsEditingAddress(!isEditingAddress)}
                className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 py-1 px-2.5 rounded-lg bg-red-950/40 border border-red-800/40 cursor-pointer"
              >
                <span>{isEditingAddress ? 'Ocultar campos' : 'Editar endereço'}</span>
                {isEditingAddress ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="bg-neutral-900/90 p-4 rounded-2xl border border-neutral-800 space-y-3">
              {!isEditingAddress && street && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black border border-neutral-800 flex items-center justify-center text-red-500 flex-shrink-0 mt-0.5">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black text-white leading-snug">
                      {street}, {number} {complement && `- ${complement}`}
                    </p>
                    <p className="text-sm text-neutral-400 font-medium mt-0.5">
                      Bairro: {neighborhood}
                    </p>
                  </div>
                </div>
              )}

              {/* Editable Address Grid */}
              {isEditingAddress && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-neutral-400 block mb-1">CEP (busca ViaCEP)</label>
                    <div className="flex gap-2">
                      <input inputMode="numeric" autoComplete="postal-code" value={cep} maxLength={9}
                        onChange={(e) => { const digits=e.target.value.replace(/\D/g,'').slice(0,8); setCep(digits.replace(/^(\d{5})(\d)/,'$1-$2')); setCepMessage(''); }}
                        onBlur={() => { if (cep.replace(/\D/g,'').length===8) void lookupCep(cep); }}
                        placeholder="00000-000"
                        className="min-w-0 flex-1 text-base p-3 rounded-xl bg-black border border-neutral-800 text-white" />
                      <button type="button" disabled={cepLoading} onClick={() => void lookupCep(cep)}
                        className="px-4 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50">
                        {cepLoading ? 'Buscando...' : 'Buscar'}
                      </button>
                    </div>
                    {cepMessage && <p role="status" className="text-xs text-neutral-300 mt-2">{cepMessage}</p>}
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-neutral-400 block mb-1">
                      Rua / Avenida
                    </label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Ex: Av. Paulista"
                      className="w-full text-base p-3.5 rounded-xl bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-400 block mb-1">
                      Número
                    </label>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="Ex: 1000"
                      className="w-full text-base p-3.5 rounded-xl bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-400 block mb-1">
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Ex: Apto 42 / Bloco B"
                      className="w-full text-base p-3.5 rounded-xl bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-medium"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-bold text-neutral-400 block mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Ex: Centro / Bela Vista"
                      className="w-full text-base p-3.5 rounded-xl bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-medium"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Forma de Pagamento */}
          <div className="space-y-3 pt-2">
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>3. Forma de Pagamento</span>
            </h3>

            <div className="grid grid-cols-3 gap-2.5">
              {/* PIX */}
              {acceptedMethods.includes('pix') && <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all text-center cursor-pointer ${
                  paymentMethod === 'pix'
                    ? 'bg-red-950/60 border-red-500 text-white shadow-lg shadow-red-950/50 scale-[1.02]'
                    : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-black/60 flex items-center justify-center text-teal-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-xs font-black">PIX</span>
              </button>}

              {/* Cartão */}
              {acceptedMethods.includes('credit_card') && <button
                type="button"
                onClick={() => setPaymentMethod('credit_card')}
                className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all text-center cursor-pointer ${
                  paymentMethod === 'credit_card'
                    ? 'bg-red-950/60 border-red-500 text-white shadow-lg shadow-red-950/50 scale-[1.02]'
                    : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-black/60 flex items-center justify-center text-blue-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-black">Cartão</span>
              </button>}

              {/* Dinheiro */}
              {acceptedMethods.includes('cash') && <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all text-center cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-red-950/60 border-red-500 text-white shadow-lg shadow-red-950/50 scale-[1.02]'
                    : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-black/60 flex items-center justify-center text-emerald-400">
                  <Banknote className="w-5 h-5" />
                </div>
                <span className="text-xs font-black">Dinheiro</span>
              </button>}
            </div>

            {acceptedMethods.length === 0 && <p className="rounded-2xl border border-red-500/40 bg-red-950/40 p-3 text-sm font-semibold text-red-300">A loja ainda não configurou uma forma de pagamento.</p>}

            {/* Informação sobre o PIX */}
            {paymentMethod === 'pix' && (
              <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-xs text-purple-200 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold text-purple-300">
                  <QrCode className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>Pagamento via PIX (Pendente de Validação)</span>
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Ao concluir o pedido, você receberá a chave PIX da loja. O status constará como <strong>Pendente</strong> até que o restaurante valide seu comprovante no painel.
                </p>
              </div>
            )}

            {/* Troco se dinheiro */}
            {paymentMethod === 'cash' && (
              <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 animate-in fade-in">
                <label className="text-xs font-bold text-neutral-400 block mb-1">
                  Precisa de troco para quanto? (Deixe em branco se não precisar)
                </label>
                <input
                  type="text"
                  value={paymentChange}
                  onChange={(e) => setPaymentChange(e.target.value)}
                  placeholder="Ex: R$ 50,00"
                  className="w-full text-base p-3 rounded-xl bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-semibold"
                />
              </div>
            )}
          </div>

          {/* Section 4: Observações do Pedido */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-neutral-400 block uppercase tracking-wider">
              Observações ou Instruções Especiais
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Tocar o interfone, sem cebola, ponto da carne..."
              rows={2}
              className="w-full text-base p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-medium resize-none"
            />
          </div>
        </div>

        {/* Right Column on Desktop: Summary and Final Action */}
        <div className="lg:col-span-5 space-y-4">
          {/* Total Summary */}
          <div className="bg-neutral-900/90 rounded-2xl p-4 sm:p-5 border border-neutral-800 space-y-3 shadow-xl">
            <h4 className="text-sm font-black text-neutral-300 uppercase tracking-wider mb-1">
              Resumo do Pedido
            </h4>
            <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-3 mb-4 space-y-2">
                <label className="text-sm font-bold text-white block">Cupom de desconto</label>
                <div className="flex gap-2">
                  <input value={couponInput} onChange={e=>{++couponRequestId.current;setCouponInput(e.target.value.toUpperCase());setCouponCode('');setCouponDiscount(0);setCouponFeedback('');setCouponLoading(false);}}
                    placeholder="Digite seu cupom" className="min-w-0 flex-1 bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-white"/>
                  <button type="button" onClick={()=>void checkCoupon()} disabled={couponLoading}
                    className="bg-red-600 rounded-lg px-3 font-bold text-white">{couponLoading?'...':'Aplicar'}</button>
                </div>
                {couponFeedback && <p role="status" className="text-xs text-neutral-300">{couponFeedback}</p>}
                {couponDiscount>0 && <p className="text-green-400 text-sm">Desconto: -{formatBRL(couponDiscount)}</p>}
              </div>
              <div className="flex justify-between text-sm text-neutral-300">
              <span>Subtotal</span>
              <span className="font-bold text-white text-base">
                {formatBRL(cartSubtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-neutral-300">
              <span>Taxa de Entrega</span>
              <span className="font-bold text-white text-base">
                {formatBRL(deliveryFee)}
              </span>
            </div>
            <div className="pt-3 border-t border-neutral-800 flex justify-between items-baseline">
              <span className="text-lg font-black text-white">
                Total do Pedido
              </span>
              <span className="text-2xl font-black text-red-500">
                {formatBRL(Math.max(0, cartTotal - couponDiscount))}
              </span>
            </div>
          </div>

          {!scheduleOpen && <p role="status" className="rounded-xl border border-amber-700 bg-amber-950/50 p-3 text-sm font-bold text-amber-200">
            Loja fechada no momento. Confira o horário de funcionamento e volte mais tarde.
          </p>}
          {/* Submit Button */}
          <button
            type="submit"
            title={!scheduleOpen ? 'Loja fechada neste horário' : undefined}
            disabled={isSubmitting || !scheduleOpen || !isRemoteStore(siteId) || acceptedMethods.length === 0}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-base sm:text-lg shadow-xl shadow-red-950/80 active:scale-98 transition-all flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Enviando Pedido...</span>
              </span>
            ) : (
              <>
                <span>{isRemoteStore(siteId) ? 'Confirmar e enviar pedido' : 'Loja em preparação'}</span>
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};




