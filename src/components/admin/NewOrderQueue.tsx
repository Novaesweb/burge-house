import React from 'react';
import { BellRing, ChevronDown, WifiOff } from 'lucide-react';
import type { Order } from '../../types';
import { pendingOrderQueue, selectOrders } from '../../utils/adminOrders';
import { formatBRL } from '../../utils/formatters';
import { OrderCard } from './OrderCard';

export function NewOrderQueue({ orders, now, busyIds, search, connected, onAccept, onReject, onDetails, onPrint, onWhatsApp }: {
  orders:Order[]; now:number; busyIds:string[]; search:string; connected:boolean;
  onAccept:(order:Order)=>void; onReject:(order:Order)=>void; onDetails:(order:Order)=>void;
  onPrint:(order:Order)=>void; onWhatsApp:(order:Order)=>void;
}) {
  const queue=pendingOrderQueue(orders);
  const current=queue[0];
  const remaining=queue.slice(1);
  const matching=new Set(selectOrders(queue,'recebido',search).map(order=>order.id));
  return <section className="new-order-queue" aria-label="Fila de atendimento de novos pedidos">
    <header className="new-order-queue-heading"><div><BellRing size={22}/><div><h3>Fila de atendimento</h3><p>Um pedido por vez, começando pelo mais antigo.</p></div></div><span role="status" aria-live="polite"><strong>{queue.length}</strong> aguardando</span></header>
    {!connected&&<p className="queue-connection-warning" role="alert"><WifiOff size={18}/>A conexão com os pedidos está indisponível. Aguarde a atualização antes de aceitar ou recusar.</p>}
    {current?<>
      {search.trim()&&<p className="queue-search-note" role="status">{matching.size} pedido(s) encontrado(s) na fila. O atendimento mantém a ordem de chegada.{!matching.has(current.id)&&' O pedido em destaque é o mais antigo e não corresponde à busca.'}</p>}
      <div className="new-order-focus" key={current.id}>
        <p className="queue-current-label">AGORA EM ATENDIMENTO · 1 DE {queue.length}</p>
        <OrderCard order={current} now={now} busy={busyIds.includes(current.id)} actionsDisabled={!connected} receiving onAdvance={()=>onAccept(current)} onReject={()=>onReject(current)} onPayment={()=>{}} onDetails={()=>onDetails(current)} onPrint={()=>onPrint(current)} onWhatsApp={()=>onWhatsApp(current)}/>
      </div>
      <details className="pending-order-list"><summary><span>Próximos pedidos <b>{remaining.length}</b></span><span>Mostrar / recolher<ChevronDown size={16}/></span></summary><ol>{remaining.filter(order=>!search.trim()||matching.has(order.id)).map(order=><li key={order.id}><div><strong>#{order.orderNumber} · {order.customerName}</strong><span>{new Date(order.createdAt).toLocaleString('pt-BR')} · {order.customerPhone}</span></div><span>{formatBRL(order.total)}</span></li>)}</ol>{!remaining.length&&<p>Nenhum outro pedido aguardando.</p>}{!!remaining.length&&search.trim()&&!remaining.some(order=>matching.has(order.id))&&<p>Nenhum dos próximos pedidos corresponde à busca.</p>}</details>
    </>:<div className="orders-empty"><BellRing size={32}/><h2>Nenhum pedido nesta etapa</h2><p>Fila atendida. O próximo pedido recebido aparecerá aqui automaticamente.</p></div>}
  </section>;
}
