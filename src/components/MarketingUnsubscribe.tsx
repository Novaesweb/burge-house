import React,{useState} from 'react';
import {unsubscribeMarketing} from '../services/marketingService';
export function MarketingUnsubscribe({storeId,token}:{storeId:string;token:string}){
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const valid=/^[a-f0-9-]{36}$/i.test(storeId)&&/^[a-f0-9-]{36}$/i.test(token);
 async function cancel(){setBusy(true);setError('');try{await unsubscribeMarketing(storeId,token);setDone(true);window.history.replaceState(null,'',window.location.pathname);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className="min-h-screen bg-black text-white grid place-items-center p-5"><section className="max-w-lg space-y-4 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
  <h1 className="text-2xl font-bold">Cancelar promoções</h1>
  <p>{done?'Cancelamento registrado. As promoções deste contato foram desautorizadas.':'Confirme para deixar de receber promoções desta loja. Os avisos dos seus pedidos continuam normalmente.'}</p>
  {!valid&&<p role="alert">Link inválido. Responda SAIR no WhatsApp da loja.</p>}
  {!done&&valid&&<button className="rounded-xl bg-red-600 p-4 font-bold disabled:opacity-40" onClick={cancel} disabled={busy}>{busy?'Cancelando…':'Cancelar promoções'}</button>}
  {error&&<p role="alert" className="text-amber-200">{error}</p>}<a href="/" className="block text-neutral-300 underline">Voltar à loja</a>
 </section></main>;
}
