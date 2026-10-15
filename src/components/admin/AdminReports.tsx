import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Package,
  Bike,
  FolderTree,
  DollarSign,
  TrendingUp,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const AdminReports: React.FC = () => {
  const { orders, products, categories } = useStore();
  const [activeTab, setActiveTab] = useState<'produtos' | 'categorias'>('produtos');

  // Compute product sales ranking
  const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  (orders || []).forEach((ord) => {
    if (ord.status !== 'cancelado') {
      (ord.items || []).forEach((item) => {
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].revenue += item.price * item.quantity;
      });
    }
  });

  const rankedProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);
  const maxQty = rankedProducts.length > 0 ? rankedProducts[0].quantity : 1;

  // Category sales ranking
  const categorySalesMap: Record<string, { name: string; count: number; revenue: number }> = {};
  (categories || []).forEach((c) => {
    categorySalesMap[c.id] = { name: c.name, count: 0, revenue: 0 };
  });

  (orders || []).forEach((ord) => {
    if (ord.status !== 'cancelado') {
      (ord.items || []).forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const catId = prod?.categoryId || 'outros';
        if (!categorySalesMap[catId]) {
          categorySalesMap[catId] = { name: 'Outros', count: 0, revenue: 0 };
        }
        categorySalesMap[catId].count += item.quantity;
        categorySalesMap[catId].revenue += item.price * item.quantity;
      });
    }
  });

  const rankedCategories = Object.values(categorySalesMap).sort((a, b) => b.revenue - a.revenue);

  const exportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Numero,Cliente,Telefone,Total,Status,Data\n';
    orders.forEach((o) => {
      csvContent += `${o.orderNumber},"${o.customerName}","${o.customerPhone}",${o.total.toFixed(2)},${o.status},"${o.createdAt}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Relatórios de Desempenho
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Análises analíticas de produtos mais vendidos, categorias, entregas e faturamento.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs border border-neutral-700 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Exportar Relatório CSV</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('produtos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'produtos'
              ? 'bg-red-600 text-white'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Produtos Mais Vendidos</span>
        </button>

        <button
          onClick={() => setActiveTab('categorias')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'categorias'
              ? 'bg-red-600 text-white'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Vendas por Categoria</span>
        </button>
      </div>

      {/* Tab 1: Produtos Mais Vendidos */}
      {activeTab === 'produtos' && (
        <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight">
            Ranking de Vendas por Produto
          </h3>

          <div className="space-y-4 pt-2">
            {rankedProducts.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                Nenhuma venda registrada ainda para calcular o ranking.
              </div>
            ) : (
              rankedProducts.map((p, idx) => {
                const percentage = Math.round((p.quantity / maxQty) * 100);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-neutral-800 text-neutral-300 flex items-center justify-center text-[10px] font-black">
                          #{idx + 1}
                        </span>
                        <span>{p.name}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-400">{p.quantity} vendidos</span>
                        <span className="font-black text-emerald-400">
                          R$ {p.revenue.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden">
                      <div
                        style={{ width: `${percentage}%` }}
                        className="h-full bg-gradient-to-r from-red-600 to-amber-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Categorias */}
      {activeTab === 'categorias' && (
        <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight">
            Faturamento por Categoria
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {rankedCategories.map((c, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{c.name}</span>
                  <span className="text-xs font-black text-emerald-400">
                    R$ {c.revenue.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  {c.count} itens vendidos
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


