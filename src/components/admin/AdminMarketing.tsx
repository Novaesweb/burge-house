import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useStore} from '../../context/StoreContext';
import {marketingAdmin,type MarketingDashboard,type MarketingJob,type MarketingCampaign} from '../../services/marketingService';
import {AdminMarketingDemo} from './AdminMarketingDemo';

const labels:Record<string,string>={draft:'Rascunho — sem envio',approved:'Aprovada',paused:'Pausada',completed:'Concluída',cancelled:'Cancelada',pending:'Na fila',claimed:'Reservada',sending:'Em processamento',accepted:'Aceita pela API',uncertain:'Revisão necessária',suppressed:'Suprimida',opted_in:'Consentimento confirmado',unsubscribed:'Cancelado'};
const button='rounded-xl border border-neutral-700 px-4 py-3 font-bold text-sm disabled:opacity-40';
export const AdminMarketing:React.FC=()=>{
 const {siteId}=useStore();
 const [tab,setTab]=useState<'real'|'demo'>('real');
 return <div className="space-y-5"><div className="flex flex-wrap gap-2" aria-label="Modo de marketing"><button aria-pressed={tab==='real'} className={button} onClick={()=>setTab('real')}>Integração real</button><button aria-pressed={tab==='demo'} className={button} onClick={()=>setTab('demo')}>Demonstração</button></div>{tab==='demo'?<AdminMarketingDemo key={siteId}/>:<RealMarketing key={siteId}/>}</div>;
};
function RealMarketing(){
 const {siteId}=useStore();
 const [data,setData]=useState<MarketingDashboard|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[segment,setSegment]=useState(0);
 const [details,setDetails]=useState<{id:string;jobs:MarketingJob[]}|null>(null);
 const requestId=useRef<string|null>(null),generation=useRef(0);
 const confirmedCount=data?.contacts.filter(c=>c.state==='opted_in').length||0;
 const serviceFresh=!!data?.settings?.synced_at&&Date.now()-Date.parse(data.settings.synced_at)<60000;
 const load=useCallback(async()=>{
  const gen=generation.current;
  try{const result=await marketingAdmin<MarketingDashboard>(siteId,'dashboard');if(gen===generation.current){setData(result);setError('');}}
  catch(e){if(gen===generation.current)setError((e as Error).message);}
 },[siteId]);
 useEffect(()=>{generation.current++;setData(null);setDetails(null);requestId.current=null;void load();const timer=window.setInterval(()=>void load(),15000);return()=>{generation.current++;window.clearInterval(timer);};},[load]);
 async function act(operation:string,args:Record<string,unknown>){
  setBusy(true);setError('');try{await marketingAdmin(siteId,operation,args);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function prepare(){requestId.current??=crypto.randomUUID();void act('prepare',{request_id:requestId.current,title,body,segment});}
 async function show(campaign:MarketingCampaign){
  const gen=generation.current;setBusy(true);
  try{const jobs=await marketingAdmin<MarketingJob[]>(siteId,'details',{id:campaign.id});if(gen===generation.current)setDetails({id:campaign.id,jobs});}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function approve(c:MarketingCampaign){
  const count=Object.values(c.counts).reduce((sum,n)=>sum+n,0);
  if(window.confirm(`Autorizar mensagens reais para os ${count} destinatários desta campanha? Confira a prévia completa antes de confirmar.`))void act('approve',{id:c.id,body:c.body,count});
 }
 return <div className="space-y-5 text-white">
  <header><h1 className="text-2xl font-black">Central de Marketing</h1><p className="text-neutral-400 mt-1">Campanhas, autorizações e histórico desta loja</p></header>
  <div className="rounded-2xl border border-amber-700 bg-amber-950/30 p-4 space-y-2 text-sm text-amber-100"><strong>{data?.settings?.enabled?'Envio liberado no servidor — cada campanha exige aprovação':'Envio real bloqueado'}</strong><p>Preparar uma campanha não envia mensagens. A conexão, a liberação do serviço e a aprovação da campanha são verificadas no servidor.</p><p>Somente clientes que confirmaram promoções no próprio WhatsApp entram na fila. Compra e avisos do pedido não autorizam marketing.</p><p>Serviço: {data?.settings?.heartbeat_at?new Date(data.settings.heartbeat_at).toLocaleString('pt-BR'):'ainda sem comunicação registrada'}. Aceitação pela API não comprova entrega ou leitura.</p></div>
  {error&&<p role="alert" className="rounded-xl border border-red-800 p-4 text-red-200">{error}</p>}
  {data?.settings&&!serviceFresh&&<p role="alert" className="rounded-xl border border-amber-700 p-4 text-amber-200">O serviço está sem sincronização recente. Confira o notebook, a internet e a Evolution antes de aprovar envios.</p>}
  {!data?.settings&&<p className="text-sm text-neutral-400">A instalação segura do servidor ainda precisa ser concluída e autorizada. A demonstração continua disponível na outra aba.</p>}
  <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3"><h2 className="text-lg font-bold">Preparar campanha sem enviar</h2>
   <label className="block">Nome<input className="block w-full rounded-xl bg-black p-3 mt-1" value={title} maxLength={90} onChange={e=>{setTitle(e.target.value);requestId.current=null;}}/></label>
   <label className="block">Mensagem<textarea className="block w-full rounded-xl bg-black p-3 mt-1" rows={5} value={body} maxLength={1000} onChange={e=>{setBody(e.target.value);requestId.current=null;}}/></label>
   <p className="text-xs text-neutral-400">A mensagem será preservada e receberá instruções e link de cancelamento individual.</p>
   <label className="block">Público autorizado<select className="block w-full rounded-xl bg-black p-3 mt-1" value={segment} onChange={e=>{setSegment(Number(e.target.value));requestId.current=null;}}><option value={0}>Todos com consentimento confirmado</option>{[30,60,90].map(n=><option key={n} value={n}>Última compra há {n}+ dias</option>)}</select></label>
   <button className={button+' bg-red-700'} disabled={busy||!data?.settings||!confirmedCount||!title.trim()||!body.trim()} onClick={prepare}>Preparar fila (sem enviar)</button>
   {!confirmedCount&&<p role="status" className="text-sm text-amber-200">Aguardando ao menos um cliente confirmar a inscrição pelo WhatsApp. Solicitar a inscrição ainda não conclui a autorização.</p>}
   <p className="text-xs text-neutral-400">Limite no servidor: 6 mensagens por 5 minutos. Não há garantia contra bloqueios do provedor.</p>
  </section>
  <section className="space-y-3"><h2 className="font-bold text-lg">Autorizações ({data?.contacts.filter(c=>c.state==='opted_in').length||0} confirmadas)</h2><div className="max-h-60 overflow-auto space-y-2">{data?.contacts.map(c=><p key={c.phone} className="rounded-xl bg-neutral-900 p-3 text-sm">{c.name} · {c.phone} · {c.state==='pending'?'Aguardando confirmação no WhatsApp':labels[c.state]}</p>)}</div></section>
  <section className="space-y-3"><h2 className="font-bold text-lg">Campanhas persistidas</h2>{data?.campaigns.map(c=><article key={c.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3"><h3 className="font-bold">{c.title} · {labels[c.state]}</h3><p className="whitespace-pre-wrap break-words text-sm">{c.body}</p><div className="flex flex-wrap gap-3 text-xs">{Object.entries(c.counts).map(([state,count])=><span key={state}>{labels[state]}: {count}</span>)}</div><div className="flex flex-wrap gap-2"><button disabled={busy} className={button} onClick={()=>void show(c)}>Ver mensagens e histórico</button>{c.state==='approved'&&<button disabled={busy} className={button} onClick={()=>void act('pause',{id:c.id})}>Pausar</button>}{['draft','paused'].includes(c.state)&&data.settings?.enabled&&details?.id===c.id&&<button disabled={busy||!serviceFresh||!Object.values(c.counts).reduce((sum,n)=>sum+n,0)} className={button} onClick={()=>approve(c)}>Aprovar envio real</button>}{!['completed','cancelled'].includes(c.state)&&<button disabled={busy} className={button} onClick={()=>void act('cancel',{id:c.id})}>Cancelar campanha</button>}</div>{details?.id===c.id&&<div className="max-h-80 overflow-auto space-y-3">{details.jobs.map(j=><div key={j.id} className="border-t border-neutral-700 pt-3 text-xs"><p>{j.phone} · {labels[j.state]} {j.result_code&&`· ${j.result_code}`}</p><p className="whitespace-pre-wrap break-words mt-2">{j.text}</p>{j.provider_id&&<p>Protocolo da API: {j.provider_id}</p>}</div>)}</div>}</article>)}</section>
  <section className="space-y-2"><h2 className="font-bold">Últimos eventos</h2>{data?.events.map(e=><p key={e.id} className="text-xs text-neutral-400 break-words">{new Date(e.created_at).toLocaleString('pt-BR')} · {e.kind} · {e.entity}</p>)}</section>
 </div>;
}
