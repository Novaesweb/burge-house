import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  QrCode,
  Banknote,
  Calendar,
  Percent,
  Receipt,
  FileText,
  Printer,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  Tag,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { PaymentMethod } from '../../types';

export const AdminSales: React.FC = () => {
  const {
    orders,
    siteSettings,
    manualPayments,
    addManualPaymentAction,
    deleteManualPaymentAction,
  } = useStore();

  const [selectedPeriod, setSelectedPeriod] = useState<'hoje' | '7dias' | '30dias' | 'todos'>('7dias');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Manual payment form states
  const [manualAmount, setManualAmount] = useState('');
  const [manualMethod, setManualMethod] = useState<PaymentMethod>('pix');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategory, setManualCategory] = useState('Venda Balcão');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getTime() - 7 * 86400000).getTime();
  const startOfMonth = new Date(now.getTime() - 30 * 86400000).getTime();

  // Valid orders that automatically feed into revenue (not cancelled)
  const validOrders = orders.filter((o) => o.status !== 'cancelado');

  // Filter orders by selected period
  const periodOrders = validOrders.filter((o) => {
    const time = new Date(o.createdAt).getTime();
    if (selectedPeriod === 'hoje') return time >= startOfDay;
    if (selectedPeriod === '7dias') return time >= startOfWeek;
    if (selectedPeriod === '30dias') return time >= startOfMonth;
    return true;
  });

  // Filter manual payments by selected period
  const periodManualPayments = manualPayments.filter((p) => {
    const time = new Date(p.createdAt).getTime();
    if (selectedPeriod === 'hoje') return time >= startOfDay;
    if (selectedPeriod === '7dias') return time >= startOfWeek;
    if (selectedPeriod === '30dias') return time >= startOfMonth;
    return true;
  });

  // Order Revenue
  const ordersRevenue = periodOrders.reduce((sum, o) => sum + o.total, 0);
  const deliveredOrdersRevenue = periodOrders
    .filter((o) => o.status === 'entregue')
    .reduce((sum, o) => sum + o.total, 0);

  // Manual Payments Revenue
  const manualRevenue = periodManualPayments.reduce((sum, p) => sum + p.amount, 0);

  // Consolidated Total Revenue
  const totalRevenue = ordersRevenue + manualRevenue;
  const totalTransactionsCount = periodOrders.length + periodManualPayments.length;
  const ticketMedio = totalTransactionsCount > 0 ? totalRevenue / totalTransactionsCount : 0;

  // Day / Week / Month consolidated metrics
  const calcConsolidated = (startTime: number) => {
    const ordRev = validOrders
      .filter((o) => new Date(o.createdAt).getTime() >= startTime)
      .reduce((sum, o) => sum + o.total, 0);
    const manRev = manualPayments
      .filter((p) => new Date(p.createdAt).getTime() >= startTime)
      .reduce((sum, p) => sum + p.amount, 0);
    return ordRev + manRev;
  };

  const vendasDoDia = calcConsolidated(startOfDay);
  const vendasDaSemana = calcConsolidated(startOfWeek);
  const vendasDoMes = calcConsolidated(startOfMonth);

  // Consolidated Payment Methods Breakdown (Orders + Manual)
  const pixRevenue =
    periodOrders.filter((o) => o.paymentMethod === 'pix').reduce((sum, o) => sum + o.total, 0) +
    periodManualPayments.filter((p) => p.paymentMethod === 'pix').reduce((sum, p) => sum + p.amount, 0);

  const cardRevenue =
    periodOrders.filter((o) => o.paymentMethod === 'credit_card').reduce((sum, o) => sum + o.total, 0) +
    periodManualPayments.filter((p) => p.paymentMethod === 'credit_card').reduce((sum, p) => sum + p.amount, 0);

  const cashRevenue =
    periodOrders.filter((o) => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.total, 0) +
    periodManualPayments.filter((p) => p.paymentMethod === 'cash').reduce((sum, p) => sum + p.amount, 0);

  const pixPercent = totalRevenue > 0 ? Math.round((pixRevenue / totalRevenue) * 100) : 0;
  const cardPercent = totalRevenue > 0 ? Math.round((cardRevenue / totalRevenue) * 100) : 0;
  const cashPercent = totalRevenue > 0 ? Math.round((cashRevenue / totalRevenue) * 100) : 0;

  const handleSaveManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(manualAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    await addManualPaymentAction({
      siteId: siteSettings.siteId,
      amount: val,
      paymentMethod: manualMethod,
      description: manualDescription.trim() || 'Lançamento Manual no Caixa',
      category: manualCategory,
      createdBy: 'Lucas Rodrigo (Dono)',
    });

    setManualAmount('');
    setManualDescription('');
    setIsManualModalOpen(false);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportWord = () => {
    const periodLabel =
      selectedPeriod === 'hoje'
        ? 'Hoje'
        : selectedPeriod === '7dias'
        ? 'Últimos 7 Dias'
        : selectedPeriod === '30dias'
        ? 'Últimos 30 Dias'
        : 'Histórico Completo';

    const orderRows = periodOrders
      .map(
        (o) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">#${o.orderNumber}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${new Date(o.createdAt).toLocaleDateString('pt-BR')} ${new Date(o.createdAt).toLocaleTimeString('pt-BR')}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${o.customerName}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${o.paymentMethod.toUpperCase()}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${o.status === 'entregue' ? 'FINALIZADO (FATURADO)' : o.status.toUpperCase()}</td>
        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">R$ ${o.total.toFixed(2).replace('.', ',')}</td>
      </tr>
    `
      )
      .join('');

    const manualRows = periodManualPayments
      .map(
        (p) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">[MANUAL]</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${new Date(p.createdAt).toLocaleDateString('pt-BR')} ${new Date(p.createdAt).toLocaleTimeString('pt-BR')}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${p.description} (${p.category || 'Balcão'})</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${p.paymentMethod.toUpperCase()}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">RECEBIDO</td>
        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">R$ ${p.amount.toFixed(2).replace('.', ',')}</td>
      </tr>
    `
      )
      .join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Relatório de Faturamento - ${siteSettings.name}</title>
        <style>
          body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; color: #333; }
          h1 { color: #b91c1c; font-size: 18pt; margin-bottom: 4px; }
          h2 { color: #444; font-size: 13pt; margin-top: 16px; border-bottom: 2px solid #b91c1c; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #b91c1c; color: white; border: 1px solid #b91c1c; padding: 8px; text-align: left; }
          .summary-box { background-color: #f9f9f9; border: 1px solid #e5e5e5; padding: 12px; margin: 15px 0; border-radius: 6px; }
        </style>
      </head>
      <body>
        <h1>${siteSettings.name} - RELATÓRIO DE FATURAMENTO</h1>
        <p><strong>Período:</strong> ${periodLabel} | <strong>Emitido em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        <p><strong>Proprietário:</strong> Lucas Rodrigo | <strong>Endereço:</strong> ${siteSettings.address}</p>
        
        <div class="summary-box">
          <h2>RESUMO CONSOLIDADO</h2>
          <p><strong>Faturamento Total:</strong> R$ ${totalRevenue.toFixed(2).replace('.', ',')}</p>
          <p><strong>- De Pedidos do Sistema:</strong> R$ ${ordersRevenue.toFixed(2).replace('.', ',')}</p>
          <p><strong>- De Lançamentos Manuais:</strong> R$ ${manualRevenue.toFixed(2).replace('.', ',')}</p>
          <p><strong>Total de Transações:</strong> ${totalTransactionsCount} | <strong>Ticket Médio:</strong> R$ ${ticketMedio.toFixed(2).replace('.', ',')}</p>
          <p><strong>Recebimentos:</strong> Pix: R$ ${pixRevenue.toFixed(2)} (${pixPercent}%) | Cartão: R$ ${cardRevenue.toFixed(2)} (${cardPercent}%) | Dinheiro: R$ ${cashRevenue.toFixed(2)} (${cashPercent}%)</p>
        </div>

        <h2>TRANSAÇÕES DO PERÍODO</h2>
        <table>
          <thead>
            <tr>
              <th>Origem</th>
              <th>Data/Hora</th>
              <th>Descrição / Cliente</th>
              <th>Forma Pgto</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${orderRows}
            ${manualRows}
          </tbody>
        </table>
        <br>
        <p style="text-align: center; color: #777; font-size: 9pt;">Relatório gerado automaticamente pelo armazenamento local - Burger House Delivery</p>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faturamento-${siteSettings.name.toLowerCase().replace(/\s+/g, '-')}-${selectedPeriod}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Gestão de Vendas & Faturamento
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Pedidos finalizados entram automaticamente no faturamento. Adicione pagamentos manuais (Pix, Dinheiro, Cartão) via local.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Manual Payment Button */}
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-red-950/60 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Adicionar Pagamento Manual</span>
          </button>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            title="Exportar relatório em PDF"
          >
            <Printer className="w-4 h-4 text-red-500" />
            <span>PDF</span>
          </button>

          {/* Export Word Button */}
          <button
            onClick={handleExportWord}
            className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            title="Exportar documento Word (.doc)"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Word</span>
          </button>

          {/* Period Filter Selector */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-2xl border border-neutral-800">
            {(
              [
                { id: 'hoje', label: 'Hoje' },
                { id: '7dias', label: '7 Dias' },
                { id: '30dias', label: '30 Dias' },
                { id: 'todos', label: 'Tudo' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  selectedPeriod === p.id
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vendas do Dia */}
        <div className="bg-neutral-900 rounded-3xl p-5 border border-neutral-800">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Vendas de Hoje</span>
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="text-2xl font-black text-white">
            R$ {vendasDoDia.toFixed(2).replace('.', ',')}
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">Pedidos + Lançamentos de hoje</span>
        </div>

        {/* Vendas da Semana */}
        <div className="bg-neutral-900 rounded-3xl p-5 border border-neutral-800">
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Vendas 7 Dias</span>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-2xl font-black text-white">
            R$ {vendasDaSemana.toFixed(2).replace('.', ',')}
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">Últimos 7 dias consolidados</span>
        </div>

        {/* Vendas do Mês */}
        <div className="bg-neutral-900 rounded-3xl p-5 border border-neutral-800">
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Vendas do Mês</span>
            <Calendar className="w-5 h-5" />
          </div>
          <div className="text-2xl font-black text-white">
            R$ {vendasDoMes.toFixed(2).replace('.', ',')}
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">Últimos 30 dias</span>
        </div>

        {/* Total Consolidado do Período */}
        <div className="bg-neutral-900 rounded-3xl p-5 border border-red-500/30 shadow-lg shadow-red-950/20">
          <div className="flex items-center justify-between text-red-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total do Período</span>
            <Percent className="w-5 h-5" />
          </div>
          <div className="text-2xl font-black text-white">
            R$ {totalRevenue.toFixed(2).replace('.', ',')}
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            {totalTransactionsCount} transações | Médio: R$ {ticketMedio.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Automatic vs Manual Breakdown Sub-Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Faturamento Automático (Pedidos)
            </span>
            <span className="text-lg font-black text-white">
              R$ {ordersRevenue.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
              ✓ {periodOrders.filter((o) => o.status === 'entregue').length} pedidos finalizados/entregues
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Faturamento Manual (Balcão / Caixa)
            </span>
            <span className="text-lg font-black text-white">
              R$ {manualRevenue.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">
              + {periodManualPayments.length} lançamento(s) avulso(s)
            </span>
          </div>
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center"
            title="Adicionar pagamento manual"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
        <h3 className="text-base font-bold text-white tracking-tight">
          Formas de Pagamento Recebidas ({selectedPeriod})
        </h3>

        {/* Stacked bar */}
        <div className="w-full h-3 rounded-full bg-neutral-950 overflow-hidden flex">
          <div style={{ width: `${pixPercent}%` }} className="h-full bg-emerald-500" />
          <div style={{ width: `${cardPercent}%` }} className="h-full bg-blue-500" />
          <div style={{ width: `${cashPercent}%` }} className="h-full bg-amber-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Pix */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Pix ({pixPercent}%)</span>
                <span className="text-[11px] text-neutral-400">
                  R$ {pixRevenue.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>

          {/* Cartão de Crédito */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Cartão ({cardPercent}%)</span>
                <span className="text-[11px] text-neutral-400">
                  R$ {cardRevenue.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>

          {/* Dinheiro */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Dinheiro ({cashPercent}%)</span>
                <span className="text-[11px] text-neutral-400">
                  R$ {cashRevenue.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Payments Table */}
      {manualPayments.length > 0 && (
        <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Tag className="w-4 h-4 text-red-500" />
              <span>Lançamentos Manuais Registrados ({manualPayments.length})</span>
            </h3>
            <span className="text-xs font-bold text-neutral-400">
              Salvo
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-400">
              <thead className="bg-neutral-950 text-neutral-400 text-[10px] font-bold uppercase border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-2.5">Data/Hora</th>
                  <th className="px-4 py-2.5">Descrição</th>
                  <th className="px-4 py-2.5">Forma</th>
                  <th className="px-4 py-2.5">Categoria</th>
                  <th className="px-4 py-2.5">Valor</th>
                  <th className="px-4 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {manualPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString('pt-BR')} {new Date(p.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{p.description}</td>
                    <td className="px-4 py-3 uppercase font-bold text-neutral-300">{p.paymentMethod}</td>
                    <td className="px-4 py-3">{p.category || 'Balcão'}</td>
                    <td className="px-4 py-3 font-black text-emerald-400">
                      R$ {p.amount.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteManualPaymentAction(p.id)}
                        className="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders List Table in Report */}
      <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-tight">
            Pedidos no Período ({periodOrders.length})
          </h3>
          <span className="text-xs font-bold text-red-500">
            Total Pedidos: R$ {ordersRevenue.toFixed(2).replace('.', ',')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-400">
            <thead className="bg-neutral-950 text-neutral-400 text-[10px] font-bold uppercase border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3"># Pedido</th>
                <th className="px-4 py-3">Data/Hora</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {periodOrders.map((o) => (
                <tr key={o.id} className="hover:bg-neutral-800/30">
                  <td className="px-4 py-3 font-bold text-white">#{o.orderNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleDateString('pt-BR')} {new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{o.customerName}</td>
                  <td className="px-4 py-3 capitalize font-semibold">{o.paymentMethod}</td>
                  <td className="px-4 py-3">
                    {o.status === 'entregue' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Finalizado (Faturado)</span>
                      </span>
                    ) : (
                      <span className="capitalize">{o.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-black text-white text-right whitespace-nowrap">
                    R$ {o.total.toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Adicionar Pagamento Manual */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsManualModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pb-4 border-b border-neutral-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-red-500" />
                <span>Adicionar Pagamento Manual</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Lançamento manual no faturamento (Pix, Dinheiro ou Cartão) salvo.
              </p>
            </div>

            <form onSubmit={handleSaveManualPayment} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="text-neutral-300 font-semibold block mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="Ex: 50.00"
                  className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-black text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualMethod('pix')}
                    className={`py-2.5 rounded-xl font-bold text-xs border text-center transition-all ${
                      manualMethod === 'pix'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    Pix
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualMethod('credit_card')}
                    className={`py-2.5 rounded-xl font-bold text-xs border text-center transition-all ${
                      manualMethod === 'credit_card'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/50'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    Cartão
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualMethod('cash')}
                    className={`py-2.5 rounded-xl font-bold text-xs border text-center transition-all ${
                      manualMethod === 'cash'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/50'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    Dinheiro
                  </button>
                </div>
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1">
                  Categoria / Origem
                </label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none"
                >
                  <option value="Venda Balcão">Venda Balcão (Presencial)</option>
                  <option value="Pedido WhatsApp">Pedido por WhatsApp</option>
                  <option value="Pagamento Antecipado">Pagamento Antecipado</option>
                  <option value="Ajuste de Caixa">Ajuste de Caixa</option>
                  <option value="Outro">Outro Recebimento</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1">
                  Descrição / Observação
                </label>
                <input
                  type="text"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Ex: 2 X-Saladas pagos no balcão"
                  className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-md shadow-red-950/50 hover:from-red-500 hover:to-rose-500"
                >
                  Salvar no Faturamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


