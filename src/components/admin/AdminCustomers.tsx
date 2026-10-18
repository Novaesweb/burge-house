import React, { useState } from 'react';
import {
  Users,
  Search,
  Phone,
  MapPin,
  ShoppingBag,
  History,
  Calendar,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Customer } from '../../types';

export const AdminCustomers: React.FC = () => {
  const { customers, orders } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const reviews = orders.filter(order => order.review);
  const avgFood = reviews.length ? (reviews.reduce((sum, order) => sum + (order.review?.foodRating || 0), 0) / reviews.length).toFixed(1) : '-';

  const filteredCustomers = customers.filter(
    (c) =>
      searchQuery === '' ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const inactiveCount = customers.filter(c => c.lastOrderAt && Date.now() - new Date(c.lastOrderAt).getTime() >= 30 * 86400000).length;
  const daysWithoutOrder = (lastOrderAt?: string) => lastOrderAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / 86400000))
    : null;

  const customerOrders = selectedCustomer
    ? orders.filter(
        (o) =>
          o.customerPhone.replace(/\D/g, '') === selectedCustomer.phone.replace(/\D/g, '') ||
          o.customerName.toLowerCase() === selectedCustomer.name.toLowerCase()
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Clientes da Loja
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Histórico e frequência de pedidos dos clientes do seu delivery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-400">Total cadastrados:</span>
          <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-white font-extrabold text-xs">
            {customers.length} clientes
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-xs text-neutral-400">Clientes cadastrados</p>
          <p className="text-2xl font-black text-white">{customers.length}</p>
        </div>
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-xs text-neutral-400">Sem pedidos há 30+ dias</p>
          <p className="text-2xl font-black text-amber-400">{inactiveCount}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-xs text-neutral-400">Avaliações recebidas</p>
          <p className="text-2xl font-black text-white">{reviews.length}</p>
        </div>
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-xs text-neutral-400">Média dos produtos</p>
          <p className="text-2xl font-black text-amber-400">{avgFood} / 5</p>
        </div>
      </div>
      {reviews.length > 0 && <section className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 space-y-3">
        <h2 className="font-bold text-white">Últimas avaliações dos pedidos</h2>
        {reviews.slice(0, 5).map(order => <div key={order.id} className="rounded-xl bg-neutral-950 p-3">
          <p className="text-sm font-bold text-white">{order.customerName} · Pedido #{order.orderNumber} · {order.review?.foodRating}/5 estrelas</p>
          {order.review?.comment && <p className="text-sm text-neutral-300 mt-1">{order.review.comment}</p>}
        </div>)}
      </section>}
      {/* Search Bar */}
      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou endereço..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/70 text-neutral-400 uppercase font-bold text-[10px] tracking-wider border-b border-neutral-800">
              <tr>
                <th className="px-5 py-3.5">Cliente</th>
                <th className="px-5 py-3.5">Telefone</th>
                <th className="px-5 py-3.5">Endereço Principal</th>
                <th className="px-5 py-3.5">Total de Pedidos</th>
                <th className="px-5 py-3.5">Total Gasto</th>
                <th className="px-5 py-3.5">Último Pedido</th>
                <th className="px-5 py-3.5">Sem pedir há</th>
                <th className="px-5 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-neutral-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-5 py-4 font-bold text-white">
                      {cust.name}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{cust.phone}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-300 max-w-xs truncate">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                        <span className="truncate">{cust.address || 'Não cadastrado'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-extrabold text-white">
                      <span className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 font-bold">
                        {cust.totalOrders} pedidos
                      </span>
                    </td>
                    <td className="px-5 py-4 font-black text-emerald-400">
                      R$ {cust.totalSpent.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-5 py-4 text-neutral-400 whitespace-nowrap">
                      {cust.lastOrderAt ? (
                        new Date(cust.lastOrderAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-300 whitespace-nowrap">
                      {daysWithoutOrder(cust.lastOrderAt) === null ? 'Sem pedidos' : `${daysWithoutOrder(cust.lastOrderAt)} dias`}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedCustomer(cust)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                      >
                        <History className="w-3.5 h-3.5 text-red-500" />
                        <span>Histórico</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Orders History Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div>
                <span className="text-[10px] text-neutral-400 block uppercase font-bold">
                  Histórico de Pedidos
                </span>
                <h3 className="text-lg font-black text-white">
                  {selectedCustomer.name} ({selectedCustomer.phone})
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {customerOrders.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  Nenhum pedido individual registrado para este cliente nesta loja.
                </div>
              ) : (
                customerOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white text-sm">
                        Pedido #{ord.orderNumber}
                      </span>
                      <span className="font-black text-emerald-400">
                        R$ {ord.total.toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <div className="text-neutral-400">
                      {(ord.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ') || 'Nenhum item'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-800/80">
                      <span>
                        {new Date(ord.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="capitalize font-bold text-neutral-300">
                        Status: {ord.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


