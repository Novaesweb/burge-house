import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Bike,
  Clock,
  XCircle,
  MapPin,
  Phone,
  User,
  CreditCard,
  QrCode,
  Banknote,
  X,
  Printer,
  MessageCircle,
  AlertTriangle,
  Volume2,
  Check,
  Columns,
  List,
  ArrowRight,
  Flame,
  ChefHat,
  ChevronRight,
  Sparkles,
  Boxes,
  DollarSign,
  BellRing,
  Star,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types';
import { OrderReceiptModal } from './OrderReceiptModal';
import { playUrgentOrderSound, playSuccessSound } from '../../utils/audioAlert';
import { formatBRL } from '../../utils/formatters';

export const AdminOrders: React.FC = () => {
  const {
    orders,
    changeOrderStatus,
    toggleOrderPaymentAction,
    siteSettings,
    selectedAdminOrder,
    setSelectedAdminOrder,
  } = useStore();

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [autoPrintOnAccept, setAutoPrintOnAccept] = useState<boolean>(() => {
    return localStorage.getItem('auto_print_on_accept') !== 'false';
  });
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Automatically open modal when navigated from GlobalOrderNotifications
  useEffect(() => {
    if (selectedAdminOrder) {
      setSelectedOrder(selectedAdminOrder);
      setSelectedAdminOrder(null);
    }
  }, [selectedAdminOrder, setSelectedAdminOrder]);

  // Update timer every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Synchronize open order modal with live armazenamento local updates in real time
  useEffect(() => {
    if (!selectedOrder) return;
    const fresh = orders.find((o) => o.id === selectedOrder.id);
    if (fresh) {
      setSelectedOrder(fresh);
    }
  }, [orders]);

  // All 7 Canonical Workflow Stages for the Owner Panel
  const allStatuses: { id: OrderStatus; label: string; color: string; dotColor: string }[] = [
    { id: 'recebido', label: '0. Novos Recebidos', color: 'bg-red-500/20 text-red-400 border-red-500/30', dotColor: 'bg-red-500' },
    { id: 'preparando', label: '1. Preparando', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dotColor: 'bg-amber-500' },
    { id: 'itens_separados', label: '2. Itens separados', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', dotColor: 'bg-indigo-500' },
    { id: 'esperando_motoboy', label: '3. Esperando motoboy', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', dotColor: 'bg-purple-500' },
    { id: 'saiu_para_entrega', label: '4. Saiu para entrega', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', dotColor: 'bg-blue-500' },
    { id: 'entregue', label: '5. Entregue', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dotColor: 'bg-emerald-500' },
    { id: 'cancelado', label: '6. Cancelado', color: 'bg-neutral-800 text-neutral-400 border-neutral-700', dotColor: 'bg-neutral-500' },
  ];

  // Helper to normalize legacy statuses
  const normalizeStatus = (status: OrderStatus): OrderStatus => {
    if (status === 'recebido') return 'recebido';
    if ((status as any) === 'pronto') return 'itens_separados';
    if ((status as any) === 'aguardando_entregador' || (status as any) === 'entregador_aceitou') return 'esperando_motoboy';
    return status;
  };

  // Play urgent alert when new unaccepted orders exist
  const newUnacceptedOrders = orders.filter((o) => normalizeStatus(o.status) === 'recebido');

  // Filtering
  const filteredOrders = orders.filter((order) => {
    const currentNorm = normalizeStatus(order.status);
    const matchesStatus =
      selectedStatusFilter === 'todos' ||
      order.status === selectedStatusFilter ||
      currentNorm === selectedStatusFilter;
    const matchesSearch =
      searchQuery === '' ||
      order.orderNumber?.toString().includes(searchQuery) ||
      order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerPhone?.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const getElapsedMinutes = (createdAt: string) => {
    try {
      const diff = Math.floor((currentTime - new Date(createdAt).getTime()) / (1000 * 60));
      return Math.max(0, isNaN(diff) ? 0 : diff);
    } catch {
      return 0;
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    const norm = normalizeStatus(status);
    const found = allStatuses.find((s) => s.id === norm);
    return (
      <span
        className={`px-2.5 py-1 rounded-xl text-xs font-black border inline-flex items-center gap-1.5 ${
          found?.color || 'bg-neutral-800 text-neutral-300'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${found?.dotColor || 'bg-neutral-400'}`} />
        <span>{found?.label || status}</span>
      </span>
    );
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    await changeOrderStatus(orderId, status);
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
    }

    // Auto-open thermal print slip when accepting a new order
    if (status === 'preparando' && autoPrintOnAccept && targetOrder) {
      setReceiptOrder(targetOrder);
    }

    playSuccessSound();
  };

  const handleTogglePayment = async (orderId: string, currentPaid: boolean) => {
    await toggleOrderPaymentAction(orderId, !currentPaid);
    playSuccessSound();
  };

  const openWhatsAppCustomer = (order: Order) => {
    const phone = order.customerPhone ? order.customerPhone.replace(/\D/g, '') : '';
    let msg = `Olá ${order.customerName}! Seu pedido #${order.orderNumber} no ${siteSettings.name} `;
    const norm = normalizeStatus(order.status);
    if (norm === 'recebido') {
      msg += `foi recebido e já estamos aceitando na loja!`;
    } else if (norm === 'preparando') {
      msg += `já está na cozinha sendo preparado com muito carinho!`;
    } else if (norm === 'itens_separados') {
      msg += `está pronto e embalado na loja!`;
    } else if (norm === 'esperando_motoboy') {
      msg += `está pronto aguardando a saída do motoboy!`;
    } else if (norm === 'saiu_para_entrega') {
      msg += `acabou de sair para entrega com o nosso motoboy!`;
    } else if (norm === 'entregue') {
      msg += `foi entregue! Bom apetite! Se puder, nos avalie.`;
    } else if (norm === 'cancelado') {
      msg += `foi cancelado. Se tiver dúvidas, estamos à disposição.`;
    }

    if (order.paymentMethod === 'pix' && !order.isPaid) {
      msg += `\n\n📌 *Chave PIX da Loja:* ${siteSettings.phone || 'Chave da Loja'}\n💰 *Total:* ${formatBRL(order.total)}\nPor favor, envie o comprovante por aqui assim que efetuar o pagamento para confirmarmos seu pedido! 👍`;
    }

    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Status counters matching the exact workflow stages
  const counts = {
    total: orders.length,
    recebido: orders.filter((o) => normalizeStatus(o.status) === 'recebido').length,
    preparando: orders.filter((o) => normalizeStatus(o.status) === 'preparando').length,
    itensSeparados: orders.filter((o) => normalizeStatus(o.status) === 'itens_separados').length,
    esperandoMotoboy: orders.filter((o) => normalizeStatus(o.status) === 'esperando_motoboy').length,
    saiuParaEntrega: orders.filter((o) => normalizeStatus(o.status) === 'saiu_para_entrega').length,
    entregue: orders.filter((o) => normalizeStatus(o.status) === 'entregue').length,
  };

  // Next Step Action based on strict Owner Workflow Rules
  const getNextAction = (order: Order) => {
    const norm = normalizeStatus(order.status);

    switch (norm) {
      case 'recebido':
        return {
          nextStatus: 'preparando' as OrderStatus,
          label: 'Aceitar Pedido ➔ Cozinha 👨‍🍳',
          icon: <ChefHat className="w-4 h-4" />,
          color: 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 text-white shadow-lg shadow-red-950/70',
          requiresPin: false,
        };

      case 'preparando':
        return {
          nextStatus: 'itens_separados' as OrderStatus,
          label: 'Concluir Preparo ➔ Separados 📦',
          icon: <Boxes className="w-4 h-4" />,
          color: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white shadow-lg shadow-indigo-950/60',
          requiresPin: false,
        };

      case 'itens_separados':
        return {
          nextStatus: 'esperando_motoboy' as OrderStatus,
          label: 'Chamar Motoboy 🛵',
          icon: <Bike className="w-4 h-4" />,
          color: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 text-white shadow-lg shadow-purple-950/60',
          requiresPin: false,
        };

      case 'esperando_motoboy':
        return {
          nextStatus: 'saiu_para_entrega' as OrderStatus,
          label: 'Despachar ➔ Saiu para Entrega 🛵',
          icon: <Bike className="w-4 h-4" />,
          color: 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 text-white shadow-lg shadow-blue-950/60',
          requiresPin: false,
        };

      case 'saiu_para_entrega':
        return {
          nextStatus: 'entregue' as OrderStatus,
          label: 'Concluir ➔ Entregue ✓',
          icon: <CheckCircle2 className="w-4 h-4" />,
          color: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white shadow-lg shadow-emerald-950/60',
          requiresPin: false,
        };

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>Gerenciamento de Pedidos</span>
            {counts.recebido > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-black animate-pulse flex items-center gap-1 shadow-lg shadow-red-950">
                <BellRing className="w-3.5 h-3.5" />
                <span>{counts.recebido} Novo(s)</span>
              </span>
            )}
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Fluxo oficial: 0. Novos Recebidos → 1. Preparando → 2. Itens separados → 3. Esperando motoboy → 4. Saiu para entrega → 5. Entregue
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Auto-print on accept toggle */}
          <button
            onClick={() => {
              const next = !autoPrintOnAccept;
              setAutoPrintOnAccept(next);
              localStorage.setItem('auto_print_on_accept', next ? 'true' : 'false');
            }}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
              autoPrintOnAccept
                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
            title="Auto-abrir comanda ao aceitar pedido"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Auto-Imprimir: {autoPrintOnAccept ? 'ATIVADO' : 'DESATIVADO'}</span>
          </button>

          {/* View Toggle */}
          <div className="bg-neutral-900 border border-neutral-800 p-1 rounded-2xl flex items-center gap-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Colunas</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>

          <button
            onClick={() => playUrgentOrderSound()}
            className="px-3.5 py-2 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-red-500/50 text-neutral-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            title="Testar alarme de som"
          >
            <Volume2 className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">Testar Alarme</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Counter Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        {/* 0. Novos Recebidos */}
        <button
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'recebido' ? 'todos' : 'recebido')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedStatusFilter === 'recebido'
              ? 'bg-red-950/90 border-red-500 shadow-lg shadow-red-950/70 scale-[1.02]'
              : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-red-400 uppercase tracking-wider">0. Novos</span>
            {counts.recebido > 0 && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />}
          </div>
          <div className="text-xl font-black text-white mt-1">{counts.recebido}</div>
        </button>

        {/* 1. Preparando */}
        <button
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'preparando' ? 'todos' : 'preparando')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedStatusFilter === 'preparando'
              ? 'bg-amber-950/80 border-amber-500 shadow-lg shadow-amber-950/50 scale-[1.02]'
              : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">1. Preparando</span>
          <div className="text-xl font-black text-white mt-1">{counts.preparando}</div>
        </button>

        {/* 2. Itens Separados */}
        <button
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'itens_separados' ? 'todos' : 'itens_separados')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedStatusFilter === 'itens_separados'
              ? 'bg-indigo-950/80 border-indigo-500 shadow-lg shadow-indigo-950/50 scale-[1.02]'
              : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">2. Separados</span>
          <div className="text-xl font-black text-white mt-1">{counts.itensSeparados}</div>
        </button>

        {/* 3. Esperando Motoboy */}
        <button
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'esperando_motoboy' ? 'todos' : 'esperando_motoboy')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedStatusFilter === 'esperando_motoboy'
              ? 'bg-purple-950/80 border-purple-500 shadow-lg shadow-purple-950/50 scale-[1.02]'
              : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">3. Esperando Motoboy</span>
          <div className="text-xl font-black text-white mt-1">{counts.esperandoMotoboy}</div>
        </button>

        {/* 4. Saiu para Entrega */}
        <button
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'saiu_para_entrega' ? 'todos' : 'saiu_para_entrega')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedStatusFilter === 'saiu_para_entrega'
              ? 'bg-blue-950/80 border-blue-500 shadow-lg shadow-blue-950/50 scale-[1.02]'
              : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">4. Em Rota</span>
          <div className="text-xl font-black text-white mt-1">{counts.saiuParaEntrega}</div>
        </button>

        {/* 5. Entregues */}
        <button
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'entregue' ? 'todos' : 'entregue')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedStatusFilter === 'entregue'
              ? 'bg-emerald-950/80 border-emerald-500 shadow-lg shadow-emerald-950/50 scale-[1.02]'
              : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">5. Entregues</span>
          <div className="text-xl font-black text-white mt-1">{counts.entregue}</div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900/90 p-4 rounded-3xl border border-neutral-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-lg">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, telefone ou nº do pedido..."
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-neutral-800 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 font-medium"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedStatusFilter('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              selectedStatusFilter === 'todos'
                ? 'bg-white text-black'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            Todos ({orders.length})
          </button>
          {allStatuses.map((s) => {
            const count = orders.filter((o) => normalizeStatus(o.status) === s.id).length;
            if (count === 0 && selectedStatusFilter !== s.id) return null;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedStatusFilter(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedStatusFilter === s.id
                    ? `${s.color} ring-1 ring-white/20`
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <span>{s.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/50">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================ */}
      {/* MODE 1: KANBAN COLUMNS (Exact 6 Stages)                          */}
      {/* ================================================================ */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start">
          {/* COLUMN 0: NOVOS RECEBIDOS */}
          <div className="bg-neutral-900/90 rounded-3xl p-3.5 border border-red-500/50 space-y-3 shadow-xl ring-1 ring-red-500/30">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-red-500 animate-bounce" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  0. Novos Recebidos
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-black animate-pulse">
                {counts.recebido}
              </span>
            </div>

            <div className="space-y-3">
              {orders
                .filter((o) => normalizeStatus(o.status) === 'recebido')
                .map((order) => renderOrderCard(order))}
              {counts.recebido === 0 && (
                <p className="text-xs text-neutral-500 text-center py-8">Nenhum pedido novo pendente.</p>
              )}
            </div>
          </div>

          {/* COLUMN 1: PREPARANDO */}
          <div className="bg-neutral-900/80 rounded-3xl p-3.5 border border-amber-900/40 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  1. Preparando
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-400 text-xs font-black">
                {counts.preparando}
              </span>
            </div>

            <div className="space-y-3">
              {orders
                .filter((o) => normalizeStatus(o.status) === 'preparando')
                .map((order) => renderOrderCard(order))}
              {counts.preparando === 0 && (
                <p className="text-xs text-neutral-500 text-center py-8">Nenhum pedido em preparo.</p>
              )}
            </div>
          </div>

          {/* COLUMN 2: ITENS SEPARADOS */}
          <div className="bg-neutral-900/80 rounded-3xl p-3.5 border border-indigo-900/40 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  2. Separados
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-400 text-xs font-black">
                {counts.itensSeparados}
              </span>
            </div>

            <div className="space-y-3">
              {orders
                .filter((o) => normalizeStatus(o.status) === 'itens_separados')
                .map((order) => renderOrderCard(order))}
              {counts.itensSeparados === 0 && (
                <p className="text-xs text-neutral-500 text-center py-8">Nenhum item separado.</p>
              )}
            </div>
          </div>

          {/* COLUMN 3: ESPERANDO MOTOBOY */}
          <div className="bg-neutral-900/80 rounded-3xl p-3.5 border border-purple-900/40 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-purple-500" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  3. Esperando Motoboy
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-400 text-xs font-black">
                {counts.esperandoMotoboy}
              </span>
            </div>

            <div className="space-y-3">
              {orders
                .filter((o) => normalizeStatus(o.status) === 'esperando_motoboy')
                .map((order) => renderOrderCard(order))}
              {counts.esperandoMotoboy === 0 && (
                <p className="text-xs text-neutral-500 text-center py-8">Nenhum pedido esperando motoboy.</p>
              )}
            </div>
          </div>

          {/* COLUMN 4: SAIU PARA ENTREGA */}
          <div className="bg-neutral-900/80 rounded-3xl p-3.5 border border-blue-900/40 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  4. Em Rota
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 text-xs font-black">
                {counts.saiuParaEntrega}
              </span>
            </div>

            <div className="space-y-3">
              {orders
                .filter((o) => normalizeStatus(o.status) === 'saiu_para_entrega')
                .map((order) => renderOrderCard(order))}
              {counts.saiuParaEntrega === 0 && (
                <p className="text-xs text-neutral-500 text-center py-8">Nenhum pedido em rota.</p>
              )}
            </div>
          </div>

          {/* COLUMN 5: ENTREGUE */}
          <div className="bg-neutral-900/80 rounded-3xl p-3.5 border border-emerald-900/40 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  5. Entregues
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-black">
                {counts.entregue}
              </span>
            </div>

            <div className="space-y-3">
              {orders
                .filter((o) => normalizeStatus(o.status) === 'entregue')
                .slice(0, 10)
                .map((order) => renderOrderCard(order))}
              {counts.entregue === 0 && (
                <p className="text-xs text-neutral-500 text-center py-8">Nenhum pedido entregue ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODE 2: FULL TABLE / LIST VIEW                                   */}
      {/* ================================================================ */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-neutral-900 border border-neutral-800 text-neutral-400">
              Nenhum pedido encontrado para o filtro selecionado.
            </div>
          ) : (
            filteredOrders.map((order) => renderOrderCard(order, true))
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* ORDER DETAILS MODAL                                              */}
      {/* ================================================================ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xl font-black text-white">
                    Pedido #{selectedOrder.orderNumber}
                  </h3>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Realizado em {new Date(selectedOrder.createdAt).toLocaleTimeString('pt-BR')} •{' '}
                  {getElapsedMinutes(selectedOrder.createdAt)} min atrás
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReceiptOrder(selectedOrder)}
                  className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                  title="Imprimir Comanda"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Flow Buttons */}
            <div className="p-4 rounded-2xl bg-black border border-neutral-800 space-y-3">
              <span className="text-xs font-black text-neutral-300 block uppercase tracking-wider">
                Alterar Status do Pedido:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allStatuses
                  .filter((s) => s.id !== 'cancelado')
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        handleStatusChange(selectedOrder.id, s.id);
                      }}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                        normalizeStatus(selectedOrder.status) === s.id
                          ? `${s.color} ring-1 ring-white/20`
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
              </div>
            </div>

            {/* Customer Details */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-850 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <User className="w-4 h-4 text-red-500" />
                  <span>{selectedOrder.customerName}</span>
                </div>
                <button
                  onClick={() => openWhatsAppCustomer(selectedOrder)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 font-bold flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>

              <div className="flex items-start gap-2 text-neutral-300">
                <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {typeof selectedOrder.deliveryAddress === 'object' && selectedOrder.deliveryAddress !== null
                      ? `${selectedOrder.deliveryAddress.street}, ${selectedOrder.deliveryAddress.number}`
                      : selectedOrder.deliveryAddress}
                  </p>
                  <p className="text-neutral-400">
                    {typeof selectedOrder.deliveryAddress === 'object' && selectedOrder.deliveryAddress !== null
                      ? `${selectedOrder.deliveryAddress.neighborhood} ${selectedOrder.deliveryAddress.complement ? `(${selectedOrder.deliveryAddress.complement})` : ''}`
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <span className="text-xs font-black text-neutral-400 uppercase tracking-wider block px-1">
                Itens do Pedido:
              </span>
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-850 divide-y divide-neutral-850 space-y-2.5">
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="pt-2.5 first:pt-0 flex items-start justify-between text-xs gap-3">
                    <div className="space-y-0.5">
                      <span className="font-black text-white text-sm">
                        {item.quantity}x {item.name}
                      </span>
                      {item.meatPoint && (
                        <div className="text-orange-400 font-bold text-[11px]">
                          🥩 Ponto: {item.meatPoint}
                        </div>
                      )}
                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                        <div className="text-emerald-400 font-semibold text-[11px]">
                          ➕ {(item.selectedAddons || []).map((a) => `${a.name} (+${formatBRL(a.price)})`).join(', ')}
                        </div>
                      )}
                      {item.removals && item.removals.length > 0 && (
                        <div className="text-red-400 font-semibold text-[11px]">
                          ❌ Sem: {item.removals.join(', ')}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-amber-400 text-[11px] mt-0.5 italic">
                          Obs: {item.notes}
                        </p>
                      )}
                    </div>
                    <span className="font-black text-neutral-200 text-sm whitespace-nowrap">
                      {formatBRL((item.price || 0) * (item.quantity || 1))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Breakdown & Payment Status Toggle */}
            <div className="p-4 rounded-2xl bg-black border border-neutral-800 space-y-3 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal:</span>
                <span className="text-white font-bold">{formatBRL(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Taxa de Entrega:</span>
                <span className="text-white font-bold">{formatBRL(selectedOrder.deliveryFee)}</span>
              </div>
              <div className="pt-2 border-t border-neutral-800 flex justify-between items-baseline">
                <span className="text-sm font-black text-white">Total a Cobrar:</span>
                <span className="text-lg font-black text-red-500">{formatBRL(selectedOrder.total)}</span>
              </div>

              {/* Payment Status Box */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-bold block">Status do Pagamento:</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-bold">
                    {selectedOrder.isPaid ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>JÁ PAGO</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>
                          {selectedOrder.paymentMethod === 'pix'
                            ? 'PIX (Pendente de Comprovante)'
                            : selectedOrder.paymentMethod === 'cash'
                            ? `Dinheiro ${selectedOrder.paymentChange ? `(Troco p/ R$ ${selectedOrder.paymentChange})` : ''}`
                            : 'Cartão na Maquininha (Cobrar na Entrega)'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTogglePayment(selectedOrder.id, !!selectedOrder.isPaid)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-colors ${
                    selectedOrder.isPaid
                      ? 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white'
                      : 'bg-emerald-950 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900'
                  }`}
                >
                  {selectedOrder.isPaid ? 'Marcar Pendente' : 'Marcar Já Pago'}
                </button>
              </div>

              {/* Customer Review if available */}
              {selectedOrder.review && (
                <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-400 flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-amber-400" />
                      <span>Avaliação do Cliente</span>
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(selectedOrder.review.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-neutral-200">
                    <div className="p-2 rounded-xl bg-black/60 border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-semibold">Comida:</span>
                      <span className="font-black text-amber-400">⭐ {selectedOrder.review.foodRating} / 5</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/60 border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-semibold">Entrega:</span>
                      <span className="font-black text-amber-400">⭐ {selectedOrder.review.deliveryRating || 5} / 5</span>
                    </div>
                  </div>

                  {selectedOrder.review.comment && (
                    <p className="text-neutral-300 italic pt-1">
                      "{selectedOrder.review.comment}"
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => handleStatusChange(selectedOrder.id, 'cancelado')}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-red-950 hover:text-red-400 text-neutral-400 text-xs font-bold transition-colors"
              >
                Cancelar Pedido
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-black transition-colors"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
      {receiptOrder && (
        <OrderReceiptModal
          order={receiptOrder}
          settings={siteSettings}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );

  // Helper to render an organized Order Card
  function renderOrderCard(order: Order, isFullWidth = false) {
    const elapsedMinutes = getElapsedMinutes(order.createdAt);
    const norm = normalizeStatus(order.status);
    const isNew = norm === 'recebido';
    const isUrgent = (norm === 'preparando' || norm === 'recebido') && elapsedMinutes >= 15;
    const nextAction = getNextAction(order);
    const isOrderPaid = !!order.isPaid;

    return (
      <div
        key={order.id}
        className={`bg-neutral-900 rounded-3xl p-4 border transition-all space-y-3 shadow-lg ${
          isNew
            ? 'border-red-500 ring-2 ring-red-500/60 bg-red-950/30'
            : isUrgent
            ? 'border-amber-500 ring-2 ring-amber-500/40 animate-pulse bg-amber-950/20'
            : 'border-neutral-800 hover:border-neutral-700'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-white tracking-tight">
                #{order.orderNumber}
              </span>
              {getStatusBadge(order.status)}
            </div>

            <span className="text-sm font-bold text-neutral-200 block mt-1 truncate">
              {order.customerName}
            </span>
          </div>

          <div className="text-right">
            <span className="text-base font-black text-white block">
              {formatBRL(order.total)}
            </span>
            <span
              className={`text-[11px] font-bold mt-0.5 inline-flex items-center gap-1 ${
                isNew
                  ? 'text-red-400 font-black animate-pulse'
                  : isUrgent
                  ? 'text-amber-400 animate-bounce'
                  : 'text-neutral-400'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>{elapsedMinutes} min</span>
            </span>
          </div>
        </div>

        {/* Payment Badge & 1-Click Toggle */}
        <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-2xl bg-black/80 border border-neutral-800">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400 font-semibold">Pagamento:</span>
            {isOrderPaid ? (
              <span className="font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>🟢 JÁ PAGO</span>
              </span>
            ) : order.paymentMethod === 'pix' ? (
              <span className="font-bold text-purple-400 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" />
                <span>PIX (Pendente)</span>
              </span>
            ) : order.paymentMethod === 'cash' ? (
              <span className="font-bold text-amber-400">
                💵 Dinheiro {order.paymentChange ? `(Troco p/ R$ ${order.paymentChange})` : ''}
              </span>
            ) : (
              <span className="font-bold text-sky-400">
                💳 Cartão na Maquininha
              </span>
            )}
          </div>

          {/* Quick toggle button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePayment(order.id, isOrderPaid);
            }}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-colors ${
              isOrderPaid
                ? 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white'
                : 'bg-emerald-950 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900'
            }`}
          >
            {isOrderPaid ? 'Reverter' : 'Marcar Pago'}
          </button>
        </div>

        {/* Address & Neighborhood */}
        <div className="p-2.5 rounded-2xl bg-black/60 border border-neutral-800 text-xs text-neutral-300 flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="truncate font-medium">
            {typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null
              ? `${order.deliveryAddress.street}, ${order.deliveryAddress.number} (${order.deliveryAddress.neighborhood})`
              : order.deliveryAddress}
          </span>
        </div>

        {/* Items Preview */}
        <div className="space-y-1 bg-black/40 p-2.5 rounded-2xl border border-neutral-850 text-xs">
          {order.items?.map((i, idx) => (
            <div key={idx} className="text-neutral-300">
              <span className="font-bold text-white">
                {i.quantity}x {i.name}
              </span>
              {i.meatPoint && (
                <span className="text-orange-400 text-[11px] font-semibold ml-1">
                  ({i.meatPoint})
                </span>
              )}
              {i.selectedAddons && i.selectedAddons.length > 0 && (
                <div className="text-emerald-400 text-[10px] pl-2">
                  + {(i.selectedAddons || []).map((a) => a.name).join(', ')}
                </div>
              )}
              {i.removals && i.removals.length > 0 && (
                <div className="text-red-400 text-[10px] pl-2 line-through">
                  Sem {i.removals.join(', ')}
                </div>
              )}
              {i.notes && (
                <div className="text-amber-400 text-[10px] italic pl-2">
                  Obs: {i.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Row */}
        <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
          {/* Quick Step Advance Button */}
          {nextAction && (
            <button
              onClick={() => handleStatusChange(order.id, nextAction.nextStatus)}
              className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all ${nextAction.color}`}
            >
              {nextAction.icon}
              <span>{nextAction.label}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            {/* WhatsApp */}
            <button
              onClick={() => openWhatsAppCustomer(order)}
              className="p-2.5 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 active:scale-95 transition-all"
              title="Abrir WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            {/* Print Receipt */}
            <button
              onClick={() => setReceiptOrder(order)}
              className="p-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white active:scale-95 transition-all"
              title="Imprimir Comanda"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* View Details */}
            <button
              onClick={() => setSelectedOrder(order)}
              className="p-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white active:scale-95 transition-all"
              title="Ver Detalhes"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }
};


