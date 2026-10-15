import React, { useState } from 'react';
import {
  Package,
  Clock,
  CheckCircle2,
  Bike,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  ArrowRight,
  Store,
  ShieldCheck,
  Shield,
  Copy,
  User,
  Headphones,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { OrderStatus } from '../../types';

export const AdminDashboard: React.FC = () => {
  const {
    orders,
    setAdminView,
    changeOrderStatus,
    siteSettings,
    adminId,
    storeAdmin,
    ownerName,
    supportTicket,
  } = useStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(type);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metrics by order status
  const novosPedidos = orders.filter((o) => o.status === 'recebido').length;
  const emPreparacao = orders.filter((o) => o.status === 'preparando').length;
  const prontos = orders.filter(
    (o) => o.status === 'itens_separados' || o.status === 'esperando_motoboy' || (o.status as any) === 'pronto'
  ).length;
  const emEntrega = orders.filter(
    (o) => o.status === 'saiu_para_entrega'
  ).length;
  const entregues = orders.filter((o) => o.status === 'entregue').length;

  // Sales metrics
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getTime() - 7 * 86400000).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const vendasDoDia = orders
    .filter((o) => new Date(o.createdAt).getTime() >= startOfDay && o.status !== 'cancelado')
    .reduce((sum, o) => sum + o.total, 0);

  const vendasDaSemana = orders
    .filter((o) => new Date(o.createdAt).getTime() >= startOfWeek && o.status !== 'cancelado')
    .reduce((sum, o) => sum + o.total, 0);

  const vendasDoMes = orders
    .filter((o) => new Date(o.createdAt).getTime() >= startOfMonth && o.status !== 'cancelado')
    .reduce((sum, o) => sum + o.total, 0);

  const recentOrders = orders.slice(0, 5);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'recebido':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Recebido
          </span>
        );
      case 'preparando':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Preparando
          </span>
        );
      case 'itens_separados':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            Separado
          </span>
        );
      case 'esperando_motoboy':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
            Esperando motoboy
          </span>
        );
      case 'saiu_para_entrega':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
            Saiu para entrega
          </span>
        );
      case 'entregue':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Entregue
          </span>
        );
      case 'cancelado':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Store Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-3xl border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Visão geral
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600/20 text-red-400 border border-red-500/30">
              {siteSettings.name}
            </span>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Tudo o que você precisa para acompanhar a sua loja, em um só lugar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 text-xs">
            <span className="text-neutral-400 block text-[10px] uppercase font-semibold">
              Status da Loja
            </span>
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {siteSettings.isOpen ? 'Aberta para pedidos' : 'Fechada'}
            </span>
          </div>

          <button
            onClick={() => setAdminView('orders')}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-950/40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Gerenciar Pedidos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setAdminView('support')}
            className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Abrir chat de suporte técnico"
          >
            <Headphones className="w-3.5 h-3.5 text-amber-400" />
            <span>Suporte Master</span>
          </button>
        </div>
      </div>

      {/* Leitor de Comunicados em Tempo Real transmitidos pelo Painel Master */}


      {/* Grid: Status dos Pedidos (5 Cards) */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-3 px-1">
          Andamento dos Pedidos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Pedidos Novos */}
          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition-colors">
            <div className="flex items-center justify-between text-blue-400 mb-2">
              <span className="text-xs font-semibold">Pedidos Novos</span>
              <Package className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{novosPedidos}</div>
            <span className="text-[11px] text-neutral-500 mt-1 block">Aguardando início</span>
          </div>

          {/* 2. Em Preparação */}
          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition-colors">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-xs font-semibold">Em Preparação</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{emPreparacao}</div>
            <span className="text-[11px] text-neutral-500 mt-1 block">Na cozinha</span>
          </div>

          {/* 3. Prontos */}
          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition-colors">
            <div className="flex items-center justify-between text-purple-400 mb-2">
              <span className="text-xs font-semibold">Prontos</span>
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{prontos}</div>
            <span className="text-[11px] text-neutral-500 mt-1 block">Aguardando motoboy</span>
          </div>

          {/* 4. Em Entrega */}
          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition-colors">
            <div className="flex items-center justify-between text-orange-400 mb-2">
              <span className="text-xs font-semibold">Em Entrega</span>
              <Bike className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{emEntrega}</div>
            <span className="text-[11px] text-neutral-500 mt-1 block">Na rota ao cliente</span>
          </div>

          {/* 5. Entregues */}
          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 hover:border-neutral-700 transition-colors col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-xs font-semibold">Entregues</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{entregues}</div>
            <span className="text-[11px] text-neutral-500 mt-1 block">Finalizados hoje</span>
          </div>
        </div>
      </div>

      {/* Grid: Vendas e Logística (4 Cards) */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-3 px-1">
          Faturamento e Logística
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Vendas do Dia */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 relative overflow-hidden">
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Vendas do Dia
              </span>
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black text-white">
              R$ {vendasDoDia.toFixed(2).replace('.', ',')}
            </div>
            <span className="text-xs text-neutral-400 mt-1 block">Hoje</span>
          </div>

          {/* Vendas da Semana */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800">
            <div className="flex items-center justify-between text-blue-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Vendas da Semana
              </span>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black text-white">
              R$ {vendasDaSemana.toFixed(2).replace('.', ',')}
            </div>
            <span className="text-xs text-neutral-400 mt-1 block">Últimos 7 dias</span>
          </div>

          {/* Vendas do Mês */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800">
            <div className="flex items-center justify-between text-purple-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Vendas do Mês
              </span>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black text-white">
              R$ {vendasDoMes.toFixed(2).replace('.', ',')}
            </div>
            <span className="text-xs text-neutral-400 mt-1 block">Mês atual</span>
          </div>

          {/* Entregas em Andamento */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800">
            <div className="flex items-center justify-between text-orange-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Entregas Ativas
              </span>
              <Bike className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black text-white">{emEntrega}</div>
            <span className="text-xs text-neutral-400 mt-1 block">
              Pedidos a caminho com o motoboy
            </span>
          </div>
        </div>
      </div>

      {/* Tabela de Pedidos Recentes */}
      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Pedidos Recentes
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Últimos pedidos realizados na sua loja
            </p>
          </div>
          <button
            onClick={() => setAdminView('orders')}
            className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <span>Ver todos ({orders.length})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/60 text-neutral-400 uppercase font-bold text-[10px] tracking-wider border-b border-neutral-800">
              <tr>
                <th className="px-5 py-3">Nº</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Itens</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Ações rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-neutral-500">
                    Nenhum pedido recente registrado.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white">
                      #{order.orderNumber}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-white block">
                        {order.customerName}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {order.customerPhone}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-neutral-300 max-w-xs truncate">
                      {(order.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ') || 'Nenhum item'}
                    </td>
                    <td className="px-5 py-3.5 font-extrabold text-white">
                      R$ {order.total.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(order.status)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {order.status === 'recebido' && (
                          <button
                            onClick={() => changeOrderStatus(order.id, 'preparando')}
                            className="px-2 py-1 rounded bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 text-[11px] font-bold"
                          >
                            Iniciar Preparo
                          </button>
                        )}
                        {order.status === 'preparando' && (
                          <button
                            onClick={() => changeOrderStatus(order.id, 'itens_separados')}
                            className="px-2 py-1 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-[11px] font-bold"
                          >
                            Separar
                          </button>
                        )}
                        {order.status === 'itens_separados' && (
                          <button
                            onClick={() => changeOrderStatus(order.id, 'esperando_motoboy')}
                            className="px-2 py-1 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 text-[11px] font-bold"
                          >
                            Aguardar Motoboy
                          </button>
                        )}
                        {order.status === 'esperando_motoboy' && (
                          <button
                            onClick={() => changeOrderStatus(order.id, 'saiu_para_entrega')}
                            className="px-2 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 text-[11px] font-bold"
                          >
                            Despachar
                          </button>
                        )}
                        {order.status === 'saiu_para_entrega' && (
                          <button
                            onClick={() => changeOrderStatus(order.id, 'entregue')}
                            className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-[11px] font-bold"
                          >
                            Concluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};




