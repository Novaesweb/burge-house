import React from 'react';
import { ArrowRight, Banknote, Bike, Boxes, CheckCircle2, ChefHat, Clock, Eye, MapPin, MessageCircle, Package, Printer, QrCode, CreditCard, XCircle } from 'lucide-react';
import type { Order, OrderStatus } from '../../types';
import { formatBRL } from '../../utils/formatters';
import { formatOrderAddress, isOrderReadyForAttention, nextOrderAction, normalizeOrderStatus, orderStage } from '../../utils/adminOrders';
import { formatScheduledTime } from '../../utils/scheduling';

export const STATUS_ICONS={recebido:Package,preparando:ChefHat,itens_separados:Boxes,esperando_motoboy:Bike,saiu_para_entrega:Bike,entregue:CheckCircle2,cancelado:XCircle};
export function OrderStatusBadge({status}:{status:string}) {
  const stage=orderStage(status);const Icon=STATUS_ICONS[normalizeOrderStatus(status)]||Package;
  return <span className={`order-status tone-${stage?.tone||'gray'}`}><Icon size={14}/>{stage?.short||status}</span>;
}
export function OrderAdvanceButton({order,busy=false,disabled=false,receiving=false,now=Date.now(),onAdvance}:{
  order:Order;busy?:boolean;disabled?:boolean;receiving?:boolean;now?:number;onAdvance:(status:OrderStatus)=>void;
}) {
  const next=nextOrderAction(order.status);
  if (order.status === 'recebido' && !isOrderReadyForAttention(order,now)) return <span className="text-sm text-violet-300">Aguardando horário de preparo</span>;
  if(!next)return null;
  const label=receiving?'Aceitar pedido':next.label;
  return <button type="button" className={`order-primary tone-${orderStage(order.status)?.tone||'red'}`} disabled={busy||disabled} aria-busy={busy} aria-label={`Pedido #${order.orderNumber}: ${label}`} onClick={()=>{if(!busy&&!disabled)onAdvance(next.status);}}>{busy?'Atualizando…':label}<ArrowRight size={16} aria-hidden="true"/></button>;
}
export function OrderCard({order,now,busy,onAdvance,onPayment,onDetails,onPrint,onWhatsApp,showPrint=true,showWhatsApp=true,list=false,receiving=false,actionsDisabled=false,onReject}:{
  order:Order;now:number;busy:boolean;list?:boolean;showPrint?:boolean;showWhatsApp?:boolean;receiving?:boolean;actionsDisabled?:boolean;onReject?:()=>void;onAdvance:()=>void;onPayment:()=>void;onDetails:()=>void;onPrint:()=>void;onWhatsApp:()=>void;
}) {
  const stage=orderStage(order.status);const isNew=normalizeOrderStatus(order.status)==='recebido';
  const minutes=Math.max(0,Math.floor((now-new Date(order.createdAt).getTime())/60000));
  const PaymentIcon=order.paymentMethod==='pix'?QrCode:order.paymentMethod==='cash'?Banknote:CreditCard;
  const payment=order.paymentMethod==='pix'?'Pix':order.paymentMethod==='cash'?'Dinheiro':order.paymentMethod==='credit_card'?'Cartão':order.paymentMethod;
  return <article className={`delivery-order-card tone-${stage?.tone||'gray'} ${isNew?'is-new':''} ${list?'is-list':''} ${receiving?'is-receiving':''}`} data-order-id={order.id} aria-label={`Pedido ${order.orderNumber}`}>
    <div className={`order-card-accent tone-${stage?.tone||'gray'}`}/>
    <header className="order-card-heading"><div><span className="order-eyebrow">PEDIDO</span><strong className="order-number">#{order.orderNumber}</strong></div><div className="order-heading-meta"><OrderStatusBadge status={order.status}/><span className={`order-time ${isNew&&minutes>=15?'is-late':''}`}><Clock size={13}/>{Number.isFinite(minutes)?`${minutes} min`:'Horário indisponível'}</span></div></header>
    {order.scheduledFor && <p className="rounded-xl border border-violet-600/40 bg-violet-950/30 p-3 text-sm text-violet-200">Agendado para {Number.isFinite(Date.parse(order.scheduledFor)) ? formatScheduledTime(order.scheduledFor) : 'horário indisponível'} (Brasília) · {order.fulfillmentMode === 'pickup' ? 'Retirada na loja' : 'Entrega'}</p>}
    <div className="order-customer"><h2>{order.customerName||'Nome não informado'}</h2><div><span>{order.customerPhone||'Telefone não informado'}</span>{showWhatsApp&&<button className="order-contact" onClick={onWhatsApp} disabled={!order.customerPhone} aria-label={`WhatsApp de ${order.customerName}`}><MessageCircle size={14}/>WhatsApp</button>}</div></div>
    <div className="order-address"><MapPin size={16}/><p>{formatOrderAddress(order)}</p></div>
    <div className="order-items"><div className="order-items-caption">ITENS DO PEDIDO <span>{order.items?.reduce((sum,item)=>sum+item.quantity,0)||0} itens</span></div><ul>{order.items?.map((item,index)=><li key={`${item.productId}-${index}`}><span className="order-quantity">{item.quantity}×</span><div><strong>{item.name}</strong>{item.meatPoint&&<small>Ponto: {item.meatPoint.replaceAll('-',' ')}</small>}{!!item.selectedAddons?.length&&<small>+ {item.selectedAddons.map(addon=>addon.name).join(', ')}</small>}{!!item.removals?.length&&<small>Remover: {item.removals.join(', ')}</small>}{item.notes&&<small className="order-item-note">Obs.: {item.notes}</small>}</div></li>)}</ul></div>
    {order.notes&&<p className="order-note"><strong>Observação do cliente</strong>{order.notes}</p>}
    <div className="order-payment"><div><span><PaymentIcon size={15}/>{payment}</span>{order.paymentChange&&<small>Troco para {order.paymentChange}</small>}{receiving?<span className={`payment-state ${order.isPaid?'paid':'pending'}`}>{order.isPaid?'Pago':'Pagamento pendente'}</span>:<button disabled={busy} className={`payment-state ${order.isPaid?'paid':'pending'}`} onClick={onPayment} title={order.isPaid?'Marcar pagamento como pendente':'Confirmar pagamento'}>{order.isPaid?<CheckCircle2 size={13}/>:<Clock size={13}/>} {order.isPaid?'Pago':'Pendente'} · {order.isPaid?'reverter':'confirmar'}</button>}</div><div className="order-total"><span>Total</span><strong>{formatBRL(order.total)}</strong></div></div>
    {receiving&&<section className="order-records" aria-label="Histórico do pedido"><h4>Histórico do pedido</h4><p><span>Recebido em</span><time>{new Date(order.createdAt).toLocaleString('pt-BR')}</time></p><p><span>Última atualização registrada</span><time>{new Date(order.updatedAt).toLocaleString('pt-BR')}</time></p></section>}
    <footer className="order-card-actions"><OrderAdvanceButton order={order} now={now} busy={busy} disabled={actionsDisabled} receiving={receiving} onAdvance={onAdvance}/>{receiving&&onReject&&<button className="order-reject" disabled={busy||actionsDisabled} onClick={onReject}><XCircle size={17}/>Recusar pedido</button>}<div className="order-secondary-actions"><button onClick={onDetails}><Eye size={15}/>{receiving||order.status==='entregue'?'Detalhes e histórico':'Ver detalhes'}</button>{showPrint&&<button onClick={onPrint} aria-label={`Imprimir pedido ${order.orderNumber}`} title="Imprimir comanda"><Printer size={16}/><span>Imprimir</span></button>}</div></footer>
  </article>;
}
