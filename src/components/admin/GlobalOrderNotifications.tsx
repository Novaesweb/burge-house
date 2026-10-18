import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Check, ChevronDown, ChevronUp, Eye, Volume2, VolumeX, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import type { Order } from '../../types';
import { getAudioContextState, isOrderSoundMuted, playOrderAlertChime, setOrderSoundMuted, unlockAudio } from '../../utils/audioAlert';
import { formatBRL } from '../../utils/formatters';
import { newUnseenOrderIds, normalizeOrderStatus, ordersForStore } from '../../utils/adminOrders';

export const GlobalOrderNotifications:React.FC=()=>{
  const {orders:allOrders,siteId,changeOrderStatus,setAdminView,setSelectedAdminOrder}=useStore();
  const orders=useMemo(()=>ordersForStore(allOrders,siteId),[allOrders,siteId]);
  const [muted,setMuted]=useState(()=>isOrderSoundMuted());
  const [expanded,setExpanded]=useState(false);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const [busy,setBusy]=useState<string[]>([]);
  const busyRef=useRef(new Set<string>());
  const [error,setError]=useState('');
  const [audioReady,setAudioReady]=useState(false);
  const seenRef=useRef<{site:string;ids:Set<string>}>({site:'',ids:new Set()});
  const [announcement,setAnnouncement]=useState('');
  const pending=orders.filter(order=>normalizeOrderStatus(order.status)==='recebido').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const visible=pending.filter(order=>!dismissed.includes(order.id));
  useEffect(()=>{
    if(seenRef.current.site!==siteId){let ids:string[]=[];try{const saved=JSON.parse(sessionStorage.getItem(`admin-notified:${siteId}`)||'[]');if(Array.isArray(saved))ids=saved.filter(id=>typeof id==='string');}catch{}seenRef.current={site:siteId,ids:new Set(ids)};setDismissed([]);}
    const ids=newUnseenOrderIds(orders,seenRef.current.ids);
    if(!ids.length)return;
    ids.forEach(id=>seenRef.current.ids.add(id));
    try{sessionStorage.setItem(`admin-notified:${siteId}`,JSON.stringify([...seenRef.current.ids].slice(-2000)));}catch{}
    setAnnouncement(`${ids.length===1?'Novo pedido recebido':`${ids.length} novos pedidos recebidos`}.`);
    if(!isOrderSoundMuted()&&getAudioContextState()==='running')playOrderAlertChime();
    if('Notification' in window&&Notification.permission==='granted'){
      try{new Notification(ids.length===1?'Novo pedido recebido':`${ids.length} novos pedidos recebidos`,{body:'Abra o painel para iniciar o atendimento.',tag:`orders-${siteId}-${ids.join('-')}`});}catch{}
    }
  },[orders,siteId]);
  const enableSound=async()=>{const ready=await unlockAudio();setAudioReady(ready);if(ready){setOrderSoundMuted(false);setMuted(false);}if('Notification' in window&&Notification.permission==='default'){try{await Notification.requestPermission();}catch{}}};
  const open=(order:Order)=>{setSelectedAdminOrder(order);setAdminView('orders');};
  const accept=async(order:Order)=>{if(busyRef.current.has(order.id))return;busyRef.current.add(order.id);setBusy([...busyRef.current]);setError('');try{await changeOrderStatus(order.id,'preparando');}catch{setError('Não foi possível iniciar o preparo. Confira a conexão e tente novamente.');}finally{busyRef.current.delete(order.id);setBusy([...busyRef.current]);}};
  return <section className={`order-notification-center ${pending.length?'has-pending':''}`} aria-label="Central de novos pedidos"><div className="notification-summary"><span className="notification-bell"><BellRing size={17}/></span><div><strong aria-live="polite">{pending.length?`${pending.length} ${pending.length===1?'novo pedido aguarda':'novos pedidos aguardam'} atendimento`:'Central de pedidos ativa'}</strong><small>{pending.length?'Os novos pedidos têm prioridade na sua fila.':'Os próximos pedidos aparecerão automaticamente.'}</small></div><div className="notification-controls"><button onClick={()=>{if(!audioReady&&!muted){void enableSound();return;}const next=!muted;setMuted(next);setOrderSoundMuted(next);if(!next)void enableSound();}} aria-label={muted||!audioReady?'Ativar som de novos pedidos':'Silenciar som de novos pedidos'} aria-pressed={!muted}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>{!audioReady&&<button className="enable-order-sound" onClick={()=>void enableSound()}>Ativar alertas</button>}{pending.length>0&&<button aria-expanded={expanded} aria-label={expanded?'Recolher avisos':'Expandir avisos'} onClick={()=>setExpanded(!expanded)}>{expanded?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>}</div></div><span className="sr-only" role="status">{announcement}</span>{error&&<p className="order-error" role="alert">{error}</p>}{expanded&&pending.length>0&&<div className="notification-orders">{visible.map(order=><div key={order.id}><button className="notification-order-name" onClick={()=>open(order)}><strong>#{order.orderNumber} · {order.customerName}</strong><span>{formatBRL(order.total)}</span></button><button onClick={()=>open(order)} aria-label={`Ver pedido ${order.orderNumber}`}><Eye size={16}/></button><button className="notification-accept" disabled={busy.includes(order.id)} onClick={()=>void accept(order)}><Check size={15}/>{busy.includes(order.id)?'Atualizando…':'Iniciar preparo'}</button><button onClick={()=>setDismissed(prev=>[...prev,order.id])} aria-label={`Dispensar aviso do pedido ${order.orderNumber}`}><X size={15}/></button></div>)}{visible.length<pending.length&&<button className="restore-notifications" onClick={()=>setDismissed([])}>Mostrar todos os avisos ({pending.length})</button>}</div>}</section>;
};

