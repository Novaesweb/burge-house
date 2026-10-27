import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useStore, type AdminView } from '../../context/StoreContext';
import { useConnect } from '../../context/ConnectContext';
import { useAdminGuide } from '../../hooks/useAdminGuide';
import { guideChapters, searchGuide, type GuideArea } from '../../utils/adminGuideContent';
import './adminGuide.css';

export function AdminGuidePanel({allowedAreas,restricted=false,onNavigate}:{allowedAreas:AdminView[];restricted?:boolean;onNavigate:(area:AdminView)=>void}){
  const {adminView,siteId}=useStore();
  const {session,store}=useConnect();
  const {preferences,warning,update}=useAdminGuide(store?.id===siteId?siteId:undefined,session?.user.id);
  const chapters=useMemo(()=>guideChapters(allowedAreas,restricted),[allowedAreas,restricted]);
  const area:GuideArea=restricted&&!['messages','support'].includes(adminView)?'account':adminView;
  const chapterIndex=chapters.findIndex(entry=>entry.area===area);
  const chapter=chapters[chapterIndex]?.chapter;
  const index=Math.max(0,chapter?.steps.findIndex(entry=>entry.id===preferences.steps[area])??0);
  const item=chapter?.steps[index];
  const [query,setQuery]=useState('');
  const results=useMemo(()=>searchGuide(chapters,query),[chapters,query]);
  const [limit,setLimit]=useState(8);
  const heading=useRef<HTMLHeadingElement>(null);
  const shouldFocus=useRef(false);
  useEffect(()=>{if(shouldFocus.current){shouldFocus.current=false;heading.current?.focus();}},[area,index,preferences.collapsed]);
  useEffect(()=>{setQuery('');setLimit(8);},[siteId,session?.user.id]);
  if(!session || store?.id!==siteId || !preferences.enabled || !chapter || !item)return null;
  const select=(nextArea:GuideArea,stepId?:string)=>{
    const next=chapters.find(entry=>entry.area===nextArea);
    if(!next)return;
    const nextStep=next.chapter.steps.find(entry=>entry.id===stepId)||next.chapter.steps[0];
    update({collapsed:false,completed:false,steps:{...preferences.steps,[nextArea]:nextStep.id}});
    setQuery('');
    if(nextArea===area && nextStep.id===item.id && !preferences.collapsed)heading.current?.focus();
    else shouldFocus.current=true;
    if(nextArea!==area)onNavigate(nextArea==='account'?'settings':nextArea);
  };
  const advance=(direction:1|-1)=>{
    const nextIndex=index+direction;
    if(nextIndex>=0 && nextIndex<chapter.steps.length){select(area,chapter.steps[nextIndex].id);return;}
    const next=chapters[chapterIndex+direction];
    if(next){select(next.area,direction===1?next.chapter.steps[0].id:next.chapter.steps.at(-1)!.id);return;}
    if(direction===1)update({completed:true,collapsed:true});
  };
  return <section className="admin-guide" aria-labelledby="admin-guide-title">
    <header className="admin-guide-header">
      <div><span className="admin-guide-eyebrow"><BookOpen size={15} aria-hidden="true"/>GUIA DO PAINEL</span><h2 id="admin-guide-title">{preferences.completed?'Guia concluído — consulte quando precisar':`Passo a passo · ${chapter.title}`}</h2></div>
      <div className="admin-guide-actions"><button type="button" aria-expanded={!preferences.collapsed} aria-controls="admin-guide-body" onClick={()=>update({collapsed:!preferences.collapsed})}><ChevronDown size={16} aria-hidden="true"/>{preferences.collapsed?'Abrir guia':'Recolher'}</button><button type="button" onClick={()=>update({enabled:false})} title="Você pode ativar novamente em Configurações"><X size={16} aria-hidden="true"/>Desativar passo a passo</button></div>
    </header>
    {!preferences.collapsed && <div id="admin-guide-body" className="admin-guide-body">
      <p className="admin-guide-notice">Este guia explica sem executar ações. Salve ou cancele formulários antes de navegar para outra área.</p>
      <div className="admin-guide-selectors"><label>Área do painel<select value={area} onChange={event=>select(event.target.value as GuideArea)}>{chapters.map(entry=><option key={entry.area} value={entry.area}>{entry.chapter.title}</option>)}</select></label><label><span><Search size={14} aria-hidden="true"/>Buscar explicação</span><input type="search" value={query} onChange={event=>{setQuery(event.target.value);setLimit(8);}} placeholder="Ex.: impressão, Pix, excluir pedido"/></label></div>
      {query.trim() && <div className="admin-guide-search"><p role="status">{results.length?`${results.length} explicação(ões) encontrada(s)`:'Nenhuma explicação encontrada. Tente outro termo.'}</p><ul>{results.slice(0,limit).map(result=><li key={`${result.area}:${result.step.id}`}><button type="button" onClick={()=>select(result.area,result.step.id)}><strong>{result.step.title}</strong><span>{result.areaTitle}</span></button></li>)}</ul>{results.length>limit&&<button type="button" onClick={()=>setLimit(value=>value+8)}>Mostrar mais explicações</button>}</div>}
      <article className="admin-guide-step"><p className="admin-guide-progress">Etapa {index+1} de {chapter.steps.length} nesta área · Área {chapterIndex+1} de {chapters.length}</p><h3 ref={heading} tabIndex={-1}>{item.title}</h3><p>{item.body}</p><ul>{item.details.map(detail=><li key={detail}>{detail}</li>)}</ul></article>
      <details className="admin-guide-topics"><summary>Ver todos os assuntos de {chapter.title}</summary><ol>{chapter.steps.map((topic,position)=><li key={topic.id}><button type="button" aria-current={topic.id===item.id?'step':undefined} onClick={()=>select(area,topic.id)}>{position+1}. {topic.title}</button></li>)}</ol></details>
      <footer className="admin-guide-controls"><button type="button" disabled={chapterIndex===0&&index===0} onClick={()=>advance(-1)}><ChevronLeft size={16} aria-hidden="true"/>Anterior</button><span>Explicação apenas. Nenhum dado será alterado.</span><button type="button" onClick={()=>advance(1)}>{index<chapter.steps.length-1?'Próximo':chapterIndex<chapters.length-1?`Continuar em ${chapters[chapterIndex+1].chapter.title}`:'Concluir guia'}<ChevronRight size={16} aria-hidden="true"/></button></footer>
    </div>}
    {warning&&<p role="status" className="admin-guide-warning">{warning}</p>}
  </section>;
}
