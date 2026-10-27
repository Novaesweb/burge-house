import React from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useConnect } from '../../context/ConnectContext';
import { useAdminGuide } from '../../hooks/useAdminGuide';

export function AdminGuideSettings(){
  const {siteId,setAdminView}=useStore();
  const {session,store}=useConnect();
  const {preferences,warning,update}=useAdminGuide(store?.id===siteId?siteId:undefined,session?.user.id);
  if(!session || store?.id!==siteId)return null;
  const start=()=>{update({enabled:true,collapsed:false,completed:false,steps:{}});setAdminView('dashboard');};
  return <section className="admin-guide-settings" aria-labelledby="guide-settings-title">
    <div><h2 id="guide-settings-title"><BookOpen size={20} aria-hidden="true"/>Passo a passo do painel</h2><p>Aprenda como usar cada área, seus botões, cuidados e limites. O guia explica; ele não envia mensagens, aceita pedidos ou salva alterações por você.</p></div>
    <label className="admin-guide-toggle"><input type="checkbox" checked={preferences.enabled} onChange={event=>update({enabled:event.target.checked,collapsed:false,completed:false})}/><span>Ativar passo a passo</span></label>
    <div className="admin-guide-settings-actions"><button type="button" onClick={start}><RotateCcw size={16} aria-hidden="true"/>Começar / reiniciar guia completo</button><p>Preferência e progresso salvos neste navegador, para sua conta nesta loja. Você pode recolher o guia sem desativá-lo.</p></div>
    {warning&&<p role="status">{warning}</p>}
  </section>;
}
