import React, { useEffect, useState } from 'react';
import {
  Settings,
  Store,
  ShieldCheck,
  Shield,
  CheckCircle2,
  Image,
  DollarSign,
  Clock,
  Phone,
  MapPin,
  Save,
  Link,
  Layers,
  Copy,
  User,
  Key,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { PaymentMethod } from '../../types';
import { WhatsAppConnection } from './WhatsAppConnection';
import { StoreOrderUsageWidget } from './StoreOrderUsageWidget';
import { settingsSectionFromUrl, settingsSectionUrl } from '../../services/planUsageService';
import { useConnect } from '../../context/ConnectContext';

export const AdminSettings: React.FC = () => {
  const {
    siteSettings,
    products,
    updateSettingsAction,
    siteId,
    adminId,
    storeAdmin,
    updateStoreAdminAction,
    ownerName,
  } = useStore();
  const { store, session } = useConnect();
  const canViewPlan = Boolean(session && ['owner', 'admin'].includes(store?.role || ''));
  const [section, setSection] = useState(() => settingsSectionFromUrl(window.location.href));
  useEffect(() => {
    const onPopState = () => setSection(settingsSectionFromUrl(window.location.href));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const selectSection = (next: 'geral' | 'plano') => {
    window.history.pushState(null, '', settingsSectionUrl(window.location.href, next));
    setSection(next);
  };

  const [name, setName] = useState(siteSettings.name);
  const [phone, setPhone] = useState(siteSettings.phone);
  const [address, setAddress] = useState(siteSettings.address);
  const [openingHours, setOpeningHours] = useState(siteSettings.openingHours);
  const [autoHoursEnabled, setAutoHoursEnabled] = useState(siteSettings.autoHoursEnabled ?? false);
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, {enabled:boolean;open:string;close:string}>>(() =>
    Object.fromEntries(Array.from({length:7},(_,day)=>[String(day),siteSettings.weeklySchedule?.[String(day)] ?? {enabled:day!==0,open:'10:00',close:'23:00'}])));
  const weekDays = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const [deliveryFee, setDeliveryFee] = useState(siteSettings.deliveryFee.toString());
  const [isOpen, setIsOpen] = useState(siteSettings.isOpen);
  const [upsellEnabled, setUpsellEnabled] = useState(siteSettings.upsellEnabled ?? false);
  const [upsellProductIds, setUpsellProductIds] = useState<string[]>(siteSettings.upsellProductIds || []);
  const [logoUrl, setLogoUrl] = useState(siteSettings.logoUrl);
  const [bannerUrl, setBannerUrl] = useState(siteSettings.bannerUrl);
  const [primaryColor, setPrimaryColor] = useState(siteSettings.primaryColor || '#dc2626');
  const [pixKey, setPixKey] = useState(siteSettings.pixKey || '');
  const [pixKeyType, setPixKeyType] = useState(siteSettings.pixKeyType || 'random');
  const [acceptedMethods, setAcceptedMethods] = useState<PaymentMethod[]>(
    siteSettings.acceptedPaymentMethods || ['pix', 'credit_card', 'cash']
  );

  // Admin profile state in local
  const [adminResponsibleName, setAdminResponsibleName] = useState(storeAdmin.name || ownerName);
  const [adminResponsibleEmail, setAdminResponsibleEmail] = useState(
    storeAdmin.email || siteSettings.ownerEmail || ''
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleMethod = (method: PaymentMethod) => {
    if (acceptedMethods.includes(method)) {
      if (acceptedMethods.length === 1) return; // keep at least one
      setAcceptedMethods(acceptedMethods.filter((m) => m !== method));
    } else {
      setAcceptedMethods([...acceptedMethods, method]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSuccessMsg('');
    setIsSaving(true);
    try {
    await Promise.all([
      updateSettingsAction({
        name,
        phone,
        address,
        openingHours,
        autoHoursEnabled,
        weeklySchedule,
        upsellEnabled,
        upsellProductIds,
        deliveryFee: parseFloat(deliveryFee.replace(',', '.')) || 0,
        isOpen,
        logoUrl,
        bannerUrl,
        primaryColor,
        acceptedPaymentMethods: acceptedMethods,
        pixKey,
        pixKeyType,
        adminId,
        adminName: adminResponsibleName,
      }),
      updateStoreAdminAction({
        name: adminResponsibleName,
        email: adminResponsibleEmail,
      }),
    ]);
    setSuccessMsg('Configurações salvas. Se alterou o número, conecte o novo WhatsApp abaixo.');
    setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setSaveError('Não foi possível concluir o salvamento. Confira sua conexão e tente novamente.');
    } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Configurações da Loja
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Personalize informações de contato, horários, taxas, visual e dados do estabelecimento.
          </p>
        </div>
      </div>

      <nav aria-label="Seções das configurações" className="flex flex-wrap gap-2 border-b border-neutral-800 pb-4">
        <button type="button" aria-current={section === 'geral' ? 'page' : undefined} onClick={() => selectSection('geral')} className={`rounded-xl px-4 py-3 text-sm font-bold ${section === 'geral' ? 'bg-red-600 text-white' : 'bg-neutral-900 text-neutral-300'}`}>Geral</button>
        {canViewPlan && <button type="button" aria-current={section === 'plano' ? 'page' : undefined} onClick={() => selectSection('plano')} className={`rounded-xl px-4 py-3 text-sm font-bold ${section === 'plano' ? 'bg-violet-600 text-white' : 'bg-neutral-900 text-neutral-300'}`}>Meu Plano</button>}
      </nav>
      {section === 'plano' ? <StoreOrderUsageWidget /> : <>
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Settings Form */}
      {saveError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{saveError}</p>}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section: Informações Básicas */}
        <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-red-500" />
            <span>Informações da Loja</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-neutral-300 font-semibold block mb-1">
                Nome do Estabelecimento
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                required
              />
            </div>

            <div>
              <label className="text-neutral-300 font-semibold block mb-1">
                Telefone / WhatsApp de Atendimento
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-neutral-300 font-semibold block mb-1">
                Endereço Físico da Loja
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="text-neutral-300 font-semibold block mb-1">
                Horário de Funcionamento Exibido
              </label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="Hoje - 10:00 às 23:00"
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="text-neutral-300 font-semibold block mb-1">
                Taxa Padrão de Entrega (R$)
              </label>
              <input
                type="number"
                step="0.50"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="sm:col-span-2 rounded-2xl bg-neutral-950 border border-neutral-800 p-4 space-y-3">
              <label className="flex gap-3 items-center text-white font-bold">
                <input type="checkbox" checked={autoHoursEnabled} onChange={e=>setAutoHoursEnabled(e.target.checked)} />
                Abrir e fechar automaticamente conforme a semana
              </label>
              <p className="text-xs text-neutral-400">Horário de Brasília. O botão de aberto/fechado abaixo funciona como bloqueio manual: se estiver fechado, a loja não aceita pedidos mesmo dentro do horário.</p>
              {weekDays.map((label,index)=>{
                const key=String(index);const day=weeklySchedule[key];
                return <div key={key} className="flex flex-wrap gap-2 items-center text-sm text-neutral-300">
                  <label className="w-28 flex gap-2 items-center"><input type="checkbox" checked={day.enabled} onChange={e=>setWeeklySchedule(prev=>({...prev,[key]:{...prev[key],enabled:e.target.checked}}))}/>{label}</label>
                  <input aria-label={`Abertura ${label}`} type="time" value={day.open} disabled={!day.enabled} onChange={e=>setWeeklySchedule(prev=>({...prev,[key]:{...prev[key],open:e.target.value}}))} className="bg-neutral-900 border border-neutral-700 rounded-lg p-2"/>
                  <span>até</span>
                  <input aria-label={`Fechamento ${label}`} type="time" value={day.close} disabled={!day.enabled} onChange={e=>setWeeklySchedule(prev=>({...prev,[key]:{...prev[key],close:e.target.value}}))} className="bg-neutral-900 border border-neutral-700 rounded-lg p-2"/>
                </div>;
              })}
            </div>
            {/* Aberto / Fechado Switch */}
            <div className="sm:col-span-2 pt-2 flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
              <div>
                <span className="text-sm font-bold text-white block">
                  Status Aberto / Fechado
                </span>
                <span className="text-[11px] text-neutral-400">
                  Quando fechado, os clientes não conseguem concluir pedidos no carrinho.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOpen ? 'bg-emerald-600' : 'bg-neutral-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isOpen ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <section className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
          <h3 className="text-base font-bold text-white">Sugestões no carrinho</h3>
          <label className="flex items-center gap-3 text-sm text-neutral-200">
            <input type="checkbox" checked={upsellEnabled} onChange={e => setUpsellEnabled(e.target.checked)} />
            Ativar sugestões de produtos
          </label>
          <p className="text-xs text-neutral-400">Escolha os produtos sugeridos. Sem seleção, o sistema mostra produtos disponíveis.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {products.filter(p => p.isActive).map(p => <label key={p.id} className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={upsellProductIds.includes(p.id)}
                onChange={e => setUpsellProductIds(prev => e.target.checked ? [...prev,p.id] : prev.filter(id => id !== p.id))} />
              <span>{p.name}</span>
            </label>)}
          </div>
        </section>
        {/* Section: Identidade do Administrador */}
        <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-amber-500" />
            <span>Dados do Administrador (ADM)</span>
          </h3>
          <p className="text-xs text-neutral-400">
            Atualize o nome e o e-mail do responsável pela loja.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-neutral-300 font-semibold block mb-1">
                Nome do Administrador / Responsável
              </label>
              <input
                type="text"
                value={adminResponsibleName}
                onChange={(e) => setAdminResponsibleName(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="text-neutral-300 font-semibold block mb-1">
                E-mail do Administrador
              </label>
              <input
                type="email"
                value={adminResponsibleEmail}
                onChange={(e) => setAdminResponsibleEmail(e.target.value)}
                placeholder="exemplo@gmail.com"
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

          </div>
        </div>

        {/* Section: Identidade Visual */}
        <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Image className="w-5 h-5 text-red-500" />
            <span>Identidade Visual</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-neutral-300 font-semibold block mb-1">
                URL do Logotipo
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="text-neutral-300 font-semibold block mb-1">
                URL do Banner Principal
              </label>
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Section: Formas de Pagamento Aceitas */}
        <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-red-500" />
            <span>Formas de Pagamento Aceitas</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <button
              type="button"
              onClick={() => toggleMethod('pix')}
              className={`p-4 rounded-2xl border text-left font-bold transition-all ${
                acceptedMethods.includes('pix')
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span>Pix Online</span>
                {acceptedMethods.includes('pix') && <CheckCircle2 className="w-4 h-4" />}
              </div>
              <span className="text-[11px] font-normal block opacity-80">
                Chave cadastrada no sistema
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleMethod('credit_card')}
              className={`p-4 rounded-2xl border text-left font-bold transition-all ${
                acceptedMethods.includes('credit_card')
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span>Cartão de Crédito</span>
                {acceptedMethods.includes('credit_card') && <CheckCircle2 className="w-4 h-4" />}
              </div>
              <span className="text-[11px] font-normal block opacity-80">
                Maquininha na entrega
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleMethod('cash')}
              className={`p-4 rounded-2xl border text-left font-bold transition-all ${
                acceptedMethods.includes('cash')
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span>Dinheiro</span>
                {acceptedMethods.includes('cash') && <CheckCircle2 className="w-4 h-4" />}
              </div>
              <span className="text-[11px] font-normal block opacity-80">
                Com solicitação de troco
              </span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
            <div>
              <label className="text-neutral-300 font-semibold block mb-1">Chave PIX</label>
              <input value={pixKey} onChange={(event) => setPixKey(event.target.value)} placeholder="Informe a chave antes de ativar PIX" className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-neutral-300 font-semibold block mb-1">Tipo da chave</label>
              <select value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as typeof pixKeyType)} className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                <option value="random">Aleatória</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="phone">Telefone</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-red-950/40 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </form>
      <WhatsAppConnection />
      </>}
    </div>
  );
};



