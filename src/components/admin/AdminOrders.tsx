import React, { useEffect, useMemo, useRef, useState } from 'react';
import { requireSupabase } from '../../lib/supabase';
import { Package, Search, CheckCircle2, Bike, Clock, MapPin, User, X, Printer, MessageCircle, Volume2, LayoutGrid, List, ArrowRight, DollarSign, BellRing, Star, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import type { Order, OrderStatus } from '../../types';
import { OrderReceiptModal } from './OrderReceiptModal';
import { OrderAdvanceButton, OrderCard, OrderStatusBadge } from './OrderCard';
import { NewOrderQueue } from './NewOrderQueue';
import { OrderStageBoard } from './OrderStageBoard';
import { ORDER_PAGE_SIZE, OrderListControls } from './OrderListControls';
import { isOrderSoundMuted, playUrgentOrderSound, playSuccessSound } from '../../utils/audioAlert';
import { formatBRL } from '../../utils/formatters';
import { ORDER_STAGES, nextOrderAction, normalizeOrderStatus, orderCounts, ordersForStore, selectOrders, whatsappNumber, orderStageFromUrl, orderStageUrl, type OrderStageView } from '../../utils/adminOrders';

export const AdminOrders: React.FC = () => {
  const {orders:allOrders,siteId,changeOrderStatus,toggleOrderPaymentAction,siteSettings,selectedAdminOrder,setSelectedAdminOrder}=useStore();
  const orders=useMemo(()=>ordersForStore(allOrders,siteId),[allOrders,siteId]);
  const [viewMode,setViewMode]=useState<'cards'|'list'>(()=>localStorage.getItem('admin_orders_view')==='list'?'list':'cards');
  const [selectedStatusFilter,setSelectedStatusFilter]=useState<OrderStageView>(()=>orderStageFromUrl(window.location.href)||'recebido');
  const [stageLimit,setStageLimit]=useState(ORDER_PAGE_SIZE);
  const selectStage=(stage:OrderStageView)=>{
    setSelectedStatusFilter(stage);
    setStageLimit(ORDER_PAGE_SIZE);
    setSelectedOrder(null);
    const next=orderStageUrl(window.location.href,stage);
    if(next!==window.location.href)window.history.pushState(window.history.state,'',next);
  };
  useEffect(()=>{
    if(!orderStageFromUrl(window.location.href))window.history.replaceState(window.history.state,'',orderStageUrl(window.location.href,'recebido'));
    const sync=()=>{setSelectedStatusFilter(orderStageFromUrl(window.location.href)||'recebido');setStageLimit(ORDER_PAGE_SIZE);setSelectedOrder(null);};
    window.addEventListener('popstate',sync);
    return()=>window.removeEventListener('popstate',sync);
  },[]);
  const [searchQuery,setSearchQuery]=useState('');
  const [selectedOrder,setSelectedOrder]=useState<Order|null>(null);
  const [receiptOrder,setReceiptOrder]=useState<Order|null>(null);
  const [deleteOrder,setDeleteOrder]=useState<Order|null>(null);
  const [deletePassword,setDeletePassword]=useState('');
  const [deleting,setDeleting]=useState(false);
  const [deleteError,setDeleteError]=useState('');
  const [autoPrintOnAccept,setAutoPrintOnAccept]=useState(()=>localStorage.getItem(`auto_print_on_accept:${siteId}`)!=='false');
  useEffect(()=>setAutoPrintOnAccept(localStorage.getItem(`auto_print_on_accept:${siteId}`)!=='false'),[siteId]);
  const [currentTime,setCurrentTime]=useState(Date.now());
  const [busyIds,setBusyIds]=useState<string[]>([]);
  const busyRef=useRef(new Set<string>());
  const [error,setError]=useState('');
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [ordersConnected,setOrdersConnected]=useState(true);
  useEffect(()=>{
    const offline=()=>setOnline(false);
    const reconnect=()=>{setOnline(true);window.dispatchEvent(new Event('delivery-remote-change'));};
    const sync=(event:Event)=>{const detail=(event as CustomEvent<{siteId:string;connected:boolean}>).detail;if(detail.siteId===siteId)setOrdersConnected(detail.connected);};
    window.addEventListener('offline',offline);window.addEventListener('online',reconnect);window.addEventListener('delivery-orders-connection',sync);
    return()=>{window.removeEventListener('offline',offline);window.removeEventListener('online',reconnect);window.removeEventListener('delivery-orders-connection',sync);};
  },[siteId]);
  const dialogRef=useRef<HTMLDivElement>(null);
  const previousSite=useRef(siteId);
  useEffect(()=>{const timer=setInterval(()=>setCurrentTime(Date.now()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(selectedAdminOrder){if(selectedAdminOrder.siteId===siteId)setSelectedOrder(selectedAdminOrder);setSelectedAdminOrder(null);}},[selectedAdminOrder,setSelectedAdminOrder,siteId]);
  useEffect(()=>{if(previousSite.current!==siteId){setSelectedOrder(null);setReceiptOrder(null);setDeleteOrder(null);setDeletePassword('');setError('');previousSite.current=siteId;}},[siteId]);
  useEffect(()=>{if(selectedOrder){const fresh=orders.find(order=>order.id===selectedOrder.id);if(fresh)setSelectedOrder(fresh);}},[orders,selectedOrder?.id]);
  useEffect(()=>{
    if(!selectedOrder)return;
    const previous=document.activeElement as HTMLElement|null;
    const dialog=dialogRef.current;dialog?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setSelectedOrder(null);
      if(event.key==='Tab'&&dialog){const nodes=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]'));const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
  },[!!selectedOrder]);
  const normalizeStatus=normalizeOrderStatus;
  const allStatuses=ORDER_STAGES.map(stage=>({...stage,color:`order-modal-status tone-${stage.tone}`}));
  const counts=orderCounts(orders);
  const filteredOrders=selectOrders(orders,selectedStatusFilter,searchQuery);
  const selectedStage=ORDER_STAGES.find(stage=>stage.id===selectedStatusFilter);
  const stageLabel=selectedStage?.label||'Visão geral';
  const stageTone=selectedStage?.tone||'gray';
  const stageCount=selectedStage?counts[selectedStage.id]:orders.length;
  const nextAttention=selectedStatusFilter==='recebido'||selectedStatusFilter==='todos'?undefined:filteredOrders.find(order=>!['entregue','cancelado'].includes(normalizeStatus(order.status)));
  const showReceiving=selectedStatusFilter==='recebido';
  const stageOrders=filteredOrders.filter(order=>normalizeStatus(order.status)!=='recebido');
  const getElapsedMinutes=(createdAt:string)=>Math.max(0,Math.floor((currentTime-new Date(createdAt).getTime())/60000)||0);
  const getStatusBadge=(status:OrderStatus)=><OrderStatusBadge status={status}/>;
  const perform=async(orderId:string,operation:()=>Promise<void>)=>{
    if(busyRef.current.has(orderId))return;
    busyRef.current.add(orderId);setBusyIds([...busyRef.current]);setError('');
    try{await operation();if(!isOrderSoundMuted()&&!orders.some(order=>normalizeStatus(order.status)==='recebido'))playSuccessSound();}catch(error){setError(error instanceof Error?error.message:'Não foi possível atualizar o pedido. Tente novamente.');}
    finally{busyRef.current.delete(orderId);setBusyIds([...busyRef.current]);}
  };
  const handleStatusChange=(orderId:string,status:OrderStatus)=>perform(orderId,async()=>{
    const target=orders.find(order=>order.id===orderId);
    if(!online||!ordersConnected)throw new Error('Sem conexão com os pedidos. Nenhuma alteração foi confirmada.');
    if(target?.status==='recebido'&&!['preparando','cancelado'].includes(status))throw new Error('Aceite ou recuse o pedido antes de continuar o atendimento.');
    await changeOrderStatus(orderId,status);
    if(target?.status==='recebido')setSelectedOrder(current=>current?.id===orderId?null:current);
    if(status==='preparando'&&target?.status==='recebido'&&autoPrintOnAccept)setReceiptOrder({...target,status});
  });
  const refuseOrder=(order:Order)=>{
    if(busyRef.current.has(order.id))return;
    if(window.confirm(`Recusar o pedido #${order.orderNumber} de ${order.customerName}? Ele ficará como cancelado e seu histórico será preservado.`))void handleStatusChange(order.id,'cancelado');
  };
  const handleTogglePayment=(orderId:string,currentPaid:boolean)=>perform(orderId,()=>toggleOrderPaymentAction(orderId,!currentPaid));
  const confirmDeleteOrder=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!deleteOrder||!deletePassword||deleting)return;
    setDeleting(true);setDeleteError('');
    try{
      const {data,error}=await requireSupabase().rpc('delivery_delete_order',{p_store_id:siteId,p_order_id:deleteOrder.id,p_password:deletePassword});
      if(error||data!==true)throw new Error(error?.message==='INVALID_PASSWORD'?'Senha incorreta.':error?.message==='NOT_AUTHORIZED'?'Somente o proprietário pode excluir pedidos.':'Não foi possível excluir o pedido. Confira a senha e tente novamente.');
      setSelectedOrder(null);setDeleteOrder(null);setDeletePassword('');
      window.dispatchEvent(new Event('delivery:refresh'));
      window.location.reload();
    }catch(err){setDeleteError(err instanceof Error?err.message:'Erro ao excluir pedido.');}
    finally{setDeleting(false);}
  };
  const openWhatsAppCustomer=(order:Order)=>{
    const number=whatsappNumber(order.customerPhone);if(!number)return;
    const messages:Record<string,string>={recebido:'foi recebido',preparando:'está em preparo',itens_separados:'está separado',esperando_motoboy:'está aguardando motoboy',saiu_para_entrega:'está a caminho',entregue:'foi entregue',cancelado:'foi cancelado'};
    let message=`Olá ${order.customerName}! Seu pedido #${order.orderNumber} no ${siteSettings.name} ${messages[normalizeStatus(order.status)]||''}.`;
    if(order.paymentMethod==='pix'&&!order.isPaid){message+=`\nTotal: ${formatBRL(order.total)}.`;if(siteSettings.pixKey)message+=`\nChave Pix: ${siteSettings.pixKey}`;message+='\nEnvie o comprovante para confirmarmos o pagamento.';}
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
  };
  const changeView=(view:'cards'|'list')=>{setViewMode(view);localStorage.setItem('admin_orders_view',view);};
  return <div className="orders-workbench">
    <header className="orders-page-heading"><div><span className="workspace-eyebrow">OPERAÇÃO DA LOJA</span><h1>Pedidos <span className="live-indicator"><i/>Atualização automática</span></h1><p>Escolha uma etapa para acompanhar somente os pedidos daquele status.</p></div><div className="orders-tools"><button className={`order-tool ${autoPrintOnAccept?'is-enabled':''}`} aria-pressed={autoPrintOnAccept} onClick={()=>{const next=!autoPrintOnAccept;setAutoPrintOnAccept(next);localStorage.setItem(`auto_print_on_accept:${siteId}`,String(next));}}><Printer size={16}/>Comanda automática <span>{autoPrintOnAccept?'Ativa':'Inativa'}</span></button><button className="order-tool" onClick={()=>playUrgentOrderSound()}><Volume2 size={16}/>Testar som</button></div></header>
    <nav className="order-stage-navigation" aria-label="Etapas dos pedidos">
      {[{id:'todos' as const,label:'Visão geral',tone:'gray',count:orders.length},...ORDER_STAGES.map(stage=>({...stage,count:counts[stage.id]}))].map(stage=><a key={stage.id} href={orderStageUrl(window.location.href,stage.id)} className={`order-stage-link tone-${stage.tone} ${selectedStatusFilter===stage.id?'is-selected':''}`} aria-current={selectedStatusFilter===stage.id?'page':undefined} onClick={event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();selectStage(stage.id);}}><span className="order-stage-name"><i/>{stage.label}</span><strong aria-label={`${stage.count} pedidos`}>{stage.count}</strong><span className="order-stage-action">{selectedStatusFilter===stage.id?'Etapa aberta':'Abrir etapa'}<ArrowRight size={13}/></span></a>)}
    </nav>
    <section className={`order-stage-page tone-${stageTone}`} aria-labelledby="order-stage-title">
      <header className="order-stage-page-heading"><div><span className="order-stage-kicker">PEDIDOS / {selectedStatusFilter==='todos'?'TODAS AS ETAPAS':'ETAPA SELECIONADA'}</span><h2 id="order-stage-title">{stageLabel}<span>{stageCount}</span></h2><p>{selectedStatusFilter==='todos'?'Todos os pedidos da loja, reunidos nesta visão geral.':`Somente pedidos em “${stageLabel}”. Ao avançar, eles seguem para a próxima etapa.`}</p></div></header>
      {nextAttention&&<div className="order-attention"><span><span className="attention-dot"/><strong>Próximo atendimento nesta etapa</strong> <span>#{nextAttention.orderNumber} · {nextAttention.customerName}</span></span><div className="order-attention-actions"><OrderAdvanceButton order={nextAttention} busy={busyIds.includes(nextAttention.id)} disabled={!online||!ordersConnected} onAdvance={status=>void handleStatusChange(nextAttention.id,status)}/><button onClick={()=>setSelectedOrder(nextAttention)}>Ver detalhes</button></div></div>}
      {error&&<div className="order-error" role="alert">{error}<button aria-label="Fechar erro" onClick={()=>setError('')}><X size={16}/></button></div>}
      <section className="orders-control-panel" aria-label={`Pesquisa em ${stageLabel}`}><div className="orders-search-row"><label className="order-search"><Search size={18}/><span className="sr-only">Buscar pedido, cliente ou telefone nesta etapa</span><input value={searchQuery} onChange={event=>{setSearchQuery(event.target.value);setStageLimit(ORDER_PAGE_SIZE);}} placeholder="Buscar nesta etapa: pedido, cliente ou telefone"/>{searchQuery&&<button aria-label="Limpar busca" onClick={()=>setSearchQuery('')}><X size={16}/></button>}</label><span className="order-results" aria-live="polite">{filteredOrders.length} {filteredOrders.length===1?'pedido':'pedidos'} nesta visualização</span>{selectedStatusFilter!=='recebido'&&<div className="order-view-toggle" role="group" aria-label="Visualização"><button aria-label="Visualização em cartões" aria-pressed={viewMode==='cards'} className={viewMode==='cards'?'is-selected':''} onClick={()=>changeView('cards')}><LayoutGrid size={17}/><span>{selectedStatusFilter==='todos'?'Kanban':'Cartões'}</span></button><button aria-label="Visualização em lista" aria-pressed={viewMode==='list'} className={viewMode==='list'?'is-selected':''} onClick={()=>changeView('list')}><List size={18}/><span>Lista</span></button></div>}</div></section>
      {showReceiving&&<NewOrderQueue key={`${siteId}:${searchQuery}`} orders={orders} now={currentTime} busyIds={busyIds} search={searchQuery} connected={online&&ordersConnected} onAccept={order=>void handleStatusChange(order.id,'preparando')} onReject={refuseOrder} onDetails={setSelectedOrder} onPrint={setReceiptOrder} onWhatsApp={openWhatsAppCustomer}/>}
      {selectedStatusFilter==='todos'&&<OrderStageBoard key={`${siteId}:${searchQuery}`} orders={orders} now={currentTime} search={searchQuery} list={viewMode==='list'} busyIds={busyIds} connected={online&&ordersConnected} onAdvance={(order,status)=>void handleStatusChange(order.id,status)} onOpenStage={selectStage} onDetails={setSelectedOrder} onWhatsApp={openWhatsAppCustomer}/>}
      {selectedStatusFilter!=='recebido'&&selectedStatusFilter!=='todos'&&(stageOrders.length>0?<div key={selectedStatusFilter} className={`delivery-orders-grid ${viewMode==='list'?'is-list':''}`} aria-label={`Pedidos: ${stageLabel}`}>{stageOrders.slice(0,stageLimit).map(order=><OrderCard key={order.id} order={order} now={currentTime} list={viewMode==='list'} busy={busyIds.includes(order.id)} actionsDisabled={!online||!ordersConnected} onAdvance={()=>{const next=nextOrderAction(order.status);if(next)void handleStatusChange(order.id,next.status);}} onPayment={()=>void handleTogglePayment(order.id,!!order.isPaid)} onDetails={()=>setSelectedOrder(order)} onPrint={()=>setReceiptOrder(order)} onWhatsApp={()=>openWhatsAppCustomer(order)}/>)}</div>:<div className="orders-empty"><Package size={34}/><h2>{searchQuery?'Nenhum pedido encontrado nesta etapa':'Nenhum pedido nesta etapa'}</h2><p>{searchQuery?'Ajuste a pesquisa para encontrar pedidos nesta visualização.':'Os pedidos aparecerão aqui automaticamente quando chegarem a esta etapa.'}</p>{searchQuery&&<button onClick={()=>setSearchQuery('')}>Limpar pesquisa</button>}</div>)}
      {selectedStatusFilter!=='recebido'&&selectedStatusFilter!=='todos'&&<OrderListControls total={stageOrders.length} limit={stageLimit} onLimitChange={setStageLimit}/>}
    </section>
      {deleteOrder && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" role="presentation"><form onSubmit={e=>void confirmDeleteOrder(e)} role="dialog" aria-modal="true" aria-label="Confirmar exclusão de pedido" className="w-full max-w-md rounded-2xl border border-red-700 bg-neutral-900 p-6 space-y-4 text-white"><h3 className="text-xl font-black text-red-400">Excluir pedido #{deleteOrder.orderNumber}?</h3><p className="text-sm text-neutral-300">Esta ação é permanente e remove o pedido do painel e do banco de dados. Somente o proprietário pode confirmar usando a senha da própria conta.</p><label className="block text-sm font-bold" htmlFor="delete-order-password">Senha do proprietário</label><input id="delete-order-password" type="password" autoComplete="current-password" required value={deletePassword} onChange={e=>setDeletePassword(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3" placeholder="Digite sua senha" />{deleteError&&<p role="alert" className="text-red-400 text-sm">{deleteError}</p>}<div className="flex gap-3"><button type="button" disabled={deleting} onClick={()=>{setDeleteOrder(null);setDeletePassword('');setDeleteError('');}} className="flex-1 rounded-xl bg-neutral-700 p-3 font-bold">Cancelar</button><button type="submit" disabled={deleting||!deletePassword} className="flex-1 rounded-xl bg-red-600 p-3 font-bold disabled:opacity-50">{deleting?'Excluindo...':'Excluir pedido'}</button></div></form></div>}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="order-dialog-title" tabIndex={-1} className="order-detail-dialog w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto space-y-5">
            {error&&<div className="order-error" role="alert">{error}</div>}
            {/* Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 id="order-dialog-title" className="text-xl font-black text-white">
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
                  onClick={() => {setDeleteOrder(selectedOrder);setDeletePassword('');setDeleteError('');}}
                  className="p-2.5 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 transition-colors"
                  title="Excluir pedido com senha"
                  aria-label="Excluir pedido com senha"
                ><Trash2 className="w-4 h-4" /></button>
                <button
                  onClick={() => setReceiptOrder(selectedOrder)}
                  className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                  title="Imprimir Comanda"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  aria-label="Fechar detalhes" onClick={() => setSelectedOrder(null)}
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
                      disabled={busyIds.includes(selectedOrder.id)||!online||!ordersConnected||(selectedOrder.status==='recebido'&&s.id!=='preparando')}
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

            <section className="order-records" aria-label="Histórico disponível"><h4>Histórico do pedido</h4><p><span>Recebido</span><time>{new Date(selectedOrder.createdAt).toLocaleString('pt-BR')}</time></p><p><span>Última atualização registrada</span><time>{new Date(selectedOrder.updatedAt).toLocaleString('pt-BR')}</time></p>{selectedOrder.notes&&<div className="order-note"><strong>Observação do cliente</strong>{selectedOrder.notes}</div>}</section>
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
                  disabled={busyIds.includes(selectedOrder.id)} onClick={() => handleTogglePayment(selectedOrder.id, !!selectedOrder.isPaid)}
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
                      <span className="font-black text-amber-400">⭐ {selectedOrder.review.deliveryRating} / 5</span>
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
                disabled={busyIds.includes(selectedOrder.id)||selectedOrder.status==='cancelado'||!online||!ordersConnected} onClick={() => refuseOrder(selectedOrder)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-red-950 hover:text-red-400 text-neutral-400 text-xs font-bold transition-colors"
              >
                Cancelar Pedido
              </button>

              <button
                aria-label="Fechar detalhes" onClick={() => setSelectedOrder(null)}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-black transition-colors"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptOrder&&<OrderReceiptModal order={receiptOrder} settings={siteSettings} onClose={()=>setReceiptOrder(null)}/>}
    </div>;
};
