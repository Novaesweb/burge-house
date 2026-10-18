import React,{useState} from 'react';
import {useStore} from '../context/StoreContext';
import {requestMarketingConsent} from '../services/marketingService';
export function MarketingConsent({orderId}:{orderId:string}){
 const {siteId}=useStore();
 const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [confirmation,setConfirmation]=useState<{challenge?:string;phone?:string}|null>(null);
 async function request(){
  if(!checked||busy)return;setBusy(true);setMessage('');
  try{const result=await requestMarketingConsent(siteId,orderId);if(result.state==='opted_in')setMessage('Este WhatsApp já confirmou promoções. Cancele quando quiser respondendo SAIR.');else setConfirmation(result);}
  catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
 }
 return <section className="my-4 w-full rounded-2xl border border-neutral-700 bg-neutral-900 p-4 text-left text-sm text-white space-y-3">
  <h2 className="font-bold">Promoções pelo WhatsApp (opcional)</h2>
  <label className="flex items-start gap-3"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} className="mt-1 size-5"/><span>Quero receber promoções desta loja no WhatsApp do meu pedido. Posso cancelar com SAIR ou pelo link das mensagens. Isso não interfere nos avisos do pedido.</span></label>
  <button type="button" disabled={!checked||busy} onClick={request} className="rounded-xl bg-red-600 px-4 py-3 font-bold disabled:opacity-40">{busy?'Preparando…':'Solicitar inscrição'}</button>
  {confirmation?.phone&&confirmation.challenge&&<div className="space-y-2"><p>Confirme usando o mesmo WhatsApp do pedido. A inscrição só será concluída após recebermos o código (válido por 48 horas).</p><a className="inline-block rounded-xl border border-green-600 p-3 text-green-300 font-bold" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${confirmation.phone}?text=${encodeURIComponent('ACEITO PROMOCOES '+confirmation.challenge)}`}>Confirmar no WhatsApp</a></div>}
  {message&&<p role="status" className="text-amber-200">{message}</p>}
 </section>;
}
