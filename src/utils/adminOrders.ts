import type { Order, OrderStatus } from '../types';

export function ordersForStore(orders:Order[],siteId:string) {return orders.filter(order=>order.siteId===siteId);}

export const ORDER_STAGES = [
  {id:'recebido',label:'Novos recebidos',short:'Novos',tone:'red',action:'Iniciar preparo',next:'preparando'},
  {id:'preparando',label:'Preparando',short:'Preparando',tone:'yellow',action:'Marcar como separado',next:'itens_separados'},
  {id:'itens_separados',label:'Separados',short:'Separados',tone:'purple',action:'Aguardar motoboy',next:'esperando_motoboy'},
  {id:'esperando_motoboy',label:'Esperando motoboy',short:'Esperando motoboy',tone:'purple',action:'Saiu para entrega',next:'saiu_para_entrega'},
  {id:'saiu_para_entrega',label:'Em rota',short:'Em rota',tone:'blue',action:'Marcar como entregue',next:'entregue'},
  {id:'entregue',label:'Entregues',short:'Entregue',tone:'green'},
  {id:'cancelado',label:'Cancelados',short:'Cancelado',tone:'gray'},
] as const;

export function normalizeOrderStatus(status: string): OrderStatus {
  if(status==='pronto')return 'itens_separados';
  if(status==='aguardando_entregador'||status==='entregador_aceitou')return 'esperando_motoboy';
  return status as OrderStatus;
}
export function orderStage(status:string) {return ORDER_STAGES.find(stage=>stage.id===normalizeOrderStatus(status));}
export function nextOrderAction(status:string) {
  const stage=orderStage(status);
  return stage && 'next' in stage ? {status:stage.next as OrderStatus,label:stage.action} : null;
}
export function orderCounts(orders:Order[]) {
  return Object.fromEntries(ORDER_STAGES.map(stage=>[stage.id,orders.filter(order=>normalizeOrderStatus(order.status)===stage.id).length])) as Record<OrderStatus,number>;
}
export function selectOrders(orders:Order[],status:string,search:string) {
  const term=search.trim().toLocaleLowerCase('pt-BR');
  const digits=term.replace(/\D/g,'');
  return orders.filter(order=>
    (status==='todos'||normalizeOrderStatus(order.status)===status) &&
    (!term||String(order.orderNumber).includes(term.replace(/^#/,''))||order.customerName?.toLocaleLowerCase('pt-BR').includes(term)||
      (digits.length>0&&order.customerPhone?.replace(/\D/g,'').includes(digits)))
  ).sort((a,b)=>{
    const priority=(order:Order)=>normalizeOrderStatus(order.status)==='recebido'?0:['entregue','cancelado'].includes(normalizeOrderStatus(order.status))?2:1;
    return priority(a)-priority(b)||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()||String(b.id).localeCompare(String(a.id));
  });
}
export function formatOrderAddress(order:Order) {
  const address=order.deliveryAddress;
  if(typeof address==='string')return address;
  if(!address)return 'Endereço não informado';
  return [ [address.street,address.number].filter(Boolean).join(', '),address.neighborhood,address.complement,address.city].filter(Boolean).join(' · ')||'Endereço não informado';
}
export function whatsappNumber(value:string) {
  const digits=(value||'').replace(/\D/g,'');
  return /^\d{10,11}$/.test(digits)?`55${digits}`:digits;
}
export function newUnseenOrderIds(orders:Order[],seen:ReadonlySet<string>) {
  return orders.filter(order=>normalizeOrderStatus(order.status)==='recebido'&&!seen.has(order.id)).map(order=>order.id);
}
export function reviewedOrders(orders:Order[]) {
  return orders.filter((order)=>!!order.review).sort((a,b)=>new Date(b.review!.createdAt).getTime()-new Date(a.review!.createdAt).getTime());
}
