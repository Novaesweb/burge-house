import React from 'react';
import { ArrowRight, Banknote, Bike, Boxes, CheckCircle2, ChefHat, Clock, Eye, MapPin, MessageCircle, Package, Printer, QrCode, CreditCard, XCircle } from 'lucide-react';
import type { Order } from '../../types';
import { formatBRL } from '../../utils/formatters';
import { formatOrderAddress, nextOrderAction, normalizeOrderStatus, orderStage } from '../../utils/adminOrders';

export const STATUS_ICONS={recebido:Package,preparando:ChefHat,itens_separados:Boxes,esperando_motoboy:Bike,saiu_para_entrega:Bike,entregue:CheckCircle2,cancelado:XCircle};
export function OrderStatusBadge({status}:{status:string}) {
  const stage=orderStage(status);const Icon=STATUS_ICONS[normalizeOrderStatus(status)]||Package;
  return <span className={`order-status tone-${stage?.tone||'gray'}`}><Icon size={14}/>{stage?.short||status}</span>;
}
export function OrderCard({order,now,busy,onAdvance,onPayment,onDetails,onPrint,onWhatsApp,list=false}:{
  order:Order;now:number;busy:boolean;list?:boolean;onAdvance:()=>void;onPayment:()=>void;onDetails:()=>void;onPrint:()=>void;onWhatsApp:()=>void;
}) {
  const stage=orderStage(order.status);const isNew=normalizeOrderStatus(order.status)==='recebido';
  const minutes=Math.max(0,Math.floor((now-new Date(order.createdAt).getTime())/60000));
  const next=nextOrderAction(order.status);
  const PaymentIcon=order.paymentMethod==='pix'?QrCode:order.paymentMethod==='cash'?Banknote:CreditCard;
  const payment=order.paymentMethod==='pix'?'Pix':order.paymentMethod==='cash'?'Dinheiro':order.paymentMethod==='credit_card'?'Cartão':order.paymentMethod;
  return <article className={`delivery-order-card ${isNew?'is-new':''} ${list?'is-list':''}`} data-order-id={order.id} aria-label={`Pedido ${order.orderNumber}`}>
    <div className={`order-card-accent tone-${stage?.tone||'gray'}`}/>
    <header className="order-card-heading"><div><span className="order-eyebrow">PEDIDO</span><strong className="order-number">#{order.orderNumber}</strong></div><div className="order-heading-meta"><OrderStatusBadge status={order.status}/><span className={`order-time ${isNew&&minutes>=15?'is-late':''}`}><Clock size={13}/>{Number.isFinite(minutes)?`${minutes} min`:'Horário indisponível'}</span></div></header>
    <div className="order-customer"><h2>{order.customerName||'Nome não informado'}</h2><div><span>{order.customerPhone||'Telefone não informado'}</span><button className="order-contact" onClick={onWhatsApp} disabled={!order.customerPhone} aria-label={`WhatsApp de ${order.customerName}`}><MessageCircle size={14}/>WhatsApp</button></div></div>
    <div className="order-address"><MapPin size={16}/><p>{formatOrderAddress(order)}</p></div>
    <div className="order-items"><div className="order-items-caption">ITENS DO PEDIDO <span>{order.items?.reduce((sum,item)=>sum+item.quantity,0)||0} itens</span></div><ul>{order.items?.map((item,index)=><li key={`${item.productId}-${index}`}><span className="order-quantity">{item.quantity}×</span><div><strong>{item.name}</strong>{item.meatPoint&&<small>Ponto: {item.meatPoint.replaceAll('-',' ')}</small>}{!!item.selectedAddons?.length&&<small>+ {item.selectedAddons.map(addon=>addon.name).join(', ')}</small>}{!!item.removals?.length&&<small>Remover: {item.removals.join(', ')}</small>}{item.notes&&<small className="order-item-note">Obs.: {item.notes}</small>}</div></li>)}</ul></div>
    {order.notes&&<p className="order-note"><strong>Observação do cliente</strong>{order.notes}</p>}
    <div className="order-payment"><div><span><PaymentIcon size={15}/>{payment}</span>{order.paymentChange&&<small>Troco para {order.paymentChange}</small>}<button disabled={busy} className={`payment-state ${order.isPaid?'paid':'pending'}`} onClick={onPayment} title={order.isPaid?'Marcar pagamento como pendente':'Confirmar pagamento'}>{order.isPaid?<CheckCircle2 size={13}/>:<Clock size={13}/>} {order.isPaid?'Pago':'Pendente'} · {order.isPaid?'reverter':'confirmar'}</button></div><div className="order-total"><span>Total</span><strong>{formatBRL(order.total)}</strong></div></div>
    <footer className="order-card-actions">{next&&<button className={`order-primary tone-${stage?.tone||'red'}`} disabled={busy} onClick={onAdvance}>{busy?'Atualizando…':next.label}<ArrowRight size={16}/></button>}<div className="order-secondary-actions"><button onClick={onDetails}><Eye size={15}/>{order.status==='entregue'?'Detalhes e histórico':'Ver detalhes'}</button><button onClick={onPrint} aria-label={`Imprimir pedido ${order.orderNumber}`} title="Imprimir comanda"><Printer size={16}/><span>Imprimir</span></button></div></footer>
  </article>;
}
