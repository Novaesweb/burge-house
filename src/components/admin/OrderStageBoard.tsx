import React, { useState } from 'react';
import { ArrowRight, Clock, Eye, MessageCircle, MapPin } from 'lucide-react';
import type { Order, OrderStatus } from '../../types';
import { ORDER_STAGES, formatOrderAddress, pendingOrderQueue, selectOrders, type OrderStageView } from '../../utils/adminOrders';
import { formatBRL } from '../../utils/formatters';
import { OrderAdvanceButton, STATUS_ICONS } from './OrderCard';
import { ORDER_PAGE_SIZE, OrderListControls } from './OrderListControls';

export function OrderStageBoard({ orders, search, now, list=false, busyIds=[], connected=true, onAdvance, onOpenStage, onDetails, onWhatsApp }: {
  orders:Order[]; search:string; now:number; list?:boolean; onOpenStage:(stage:OrderStageView)=>void;
  busyIds?:string[];connected?:boolean;onAdvance?:(order:Order,status:OrderStatus)=>void;
  onDetails:(order:Order)=>void; onWhatsApp:(order:Order)=>void;
}) {
  const pending=pendingOrderQueue(orders);
  const [limits,setLimits]=useState<Record<string,number>>({});
  return <section className={`order-kanban-board ${list?'is-list':''}`} aria-label="Visão geral de pedidos por etapa">
    {ORDER_STAGES.map(stage=>{
      const Icon=STATUS_ICONS[stage.id];
      const stageOrders=selectOrders(orders,stage.id,search);
      // Receiving is handled exclusively in its queue; this column is a preview.
      const limit=limits[stage.id]??ORDER_PAGE_SIZE;
      const cards=stage.id==='recebido'?pending.slice(0,1).filter(order=>!search.trim()||stageOrders.some(match=>match.id===order.id)):stageOrders.slice(0,limit);
      return <section key={stage.id} className={`order-kanban-column tone-${stage.tone}`} aria-label={stage.label}>
        <button className="order-kanban-heading" onClick={()=>onOpenStage(stage.id)}><Icon size={23}/><span><strong>{stage.label}</strong><small>{stageOrders.length} pedido(s)</small></span><b>{stageOrders.length}</b></button>
        <div className="order-kanban-content">{cards.map(order=><article key={order.id} className="order-kanban-card" aria-label={`Pedido ${order.orderNumber}`}>
          <header><strong>#{order.orderNumber}</strong><span><Clock size={12}/>{Math.max(0,Math.floor((now-new Date(order.createdAt).getTime())/60000))} min</span></header>
          <h3>{order.customerName}</h3><div className="kanban-contact"><span>{order.customerPhone}</span><button onClick={()=>onWhatsApp(order)} aria-label={`WhatsApp de ${order.customerName}`}><MessageCircle size={12}/>WhatsApp</button></div>
          <p className="kanban-address"><MapPin size={13}/>{formatOrderAddress(order)}</p>
          {!['entregue','cancelado'].includes(stage.id)&&<ul className="kanban-items">{order.items.map((item,index)=><li key={`${item.productId}:${index}`}><b>{item.quantity}×</b><span>{item.name}</span></li>)}</ul>}
          <div className="kanban-total"><span>{order.items.reduce((count,item)=>count+item.quantity,0)} itens</span><strong>{formatBRL(order.total)}</strong></div>
          <div className="kanban-card-actions">
            {onAdvance&&<OrderAdvanceButton order={order} busy={busyIds.includes(order.id)} disabled={!connected} onAdvance={status=>onAdvance(order,status)}/>}
            <button className="kanban-open-order" onClick={()=>stage.id==='recebido'?onOpenStage('recebido'):onDetails(order)}>{stage.id==='recebido'?<ArrowRight size={14}/>:<Eye size={14}/>} {stage.id==='recebido'?'Atender fila':'Ver pedido'}</button>
          </div>
        </article>)}
        {stage.id!=='recebido'&&<OrderListControls total={stageOrders.length} limit={limit} onLimitChange={value=>setLimits(previous=>({...previous,[stage.id]:value}))}/>}
        {stage.id==='recebido'&&pending.length>1&&<button className="kanban-queue-count" onClick={()=>onOpenStage('recebido')}>+ {pending.length-1} pedido(s) na fila recolhida<ArrowRight size={15}/></button>}
        {!cards.length&&<div className="kanban-empty"><Icon size={39}/><strong>Nenhum pedido</strong><p>{search?'Nenhum resultado nesta etapa.':`Os pedidos em “${stage.label}” aparecerão aqui.`}</p></div>}</div>
      </section>;
    })}
  </section>;
}
