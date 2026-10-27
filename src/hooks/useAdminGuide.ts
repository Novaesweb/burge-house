import { useCallback, useEffect, useRef, useState } from 'react';

export interface GuidePreferences { enabled: boolean; collapsed: boolean; completed: boolean; steps: Record<string,string> }
export const GUIDE_EVENT = 'novaesweb-admin-guide';
export const defaultGuidePreferences = ():GuidePreferences => ({enabled:false,collapsed:false,completed:false,steps:{}});
export const guideStorageKey = (storeId:string,userId:string) => `novaesweb:admin-guide:v1:${userId}:${storeId}`;
export function parseGuidePreferences(value:unknown):GuidePreferences {
  if(!value || typeof value!=='object' || Array.isArray(value))return defaultGuidePreferences();
  const row=value as Record<string,unknown>;
  const steps:Record<string,string>={};
  if(row.steps && typeof row.steps==='object' && !Array.isArray(row.steps)){
    for(const [area,step] of Object.entries(row.steps))if(/^[a-z]+$/.test(area) && typeof step==='string' && /^[a-z0-9-]{1,80}$/.test(step))steps[area]=step;
  }
  return {enabled:row.enabled===true,collapsed:row.collapsed===true,completed:row.completed===true,steps};
}

// Educational preference only: never grants permissions or changes store data.
export function useAdminGuide(storeId?:string,userId?:string) {
  const identity=storeId&&userId?guideStorageKey(storeId,userId):'';
  const [snapshot,setSnapshot]=useState<{identity:string;preferences:GuidePreferences;warning:string}>({identity:'',preferences:defaultGuidePreferences(),warning:''});
  const current=useRef(snapshot);
  const apply=useCallback((preferences:GuidePreferences,warning='')=>{
    const value={identity,preferences,warning};current.current=value;setSnapshot(value);
  },[identity]);
  useEffect(()=>{
    const load=()=>{
      if(!identity){apply(defaultGuidePreferences());return;}
      try{apply(parseGuidePreferences(JSON.parse(localStorage.getItem(identity)||'null')));}
      catch{apply(defaultGuidePreferences(),'Não foi possível recuperar o guia salvo neste navegador.');}
    };
    load();
    const changed=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(identity && detail?.key===identity)apply(parseGuidePreferences(detail.preferences),detail.warning||'');
    };
    const stored=(event:StorageEvent)=>{if(event.key===identity || event.key===null)load();};
    window.addEventListener(GUIDE_EVENT,changed);window.addEventListener('storage',stored);
    return()=>{window.removeEventListener(GUIDE_EVENT,changed);window.removeEventListener('storage',stored);};
  },[identity,apply]);
  const update=useCallback((change:Partial<GuidePreferences>)=>{
    if(!identity)return;
    const previous=current.current.identity===identity?current.current.preferences:defaultGuidePreferences();
    const preferences=parseGuidePreferences({...previous,...change});
    let warning='';
    try{localStorage.setItem(identity,JSON.stringify(preferences));}
    catch{warning='O navegador não permitiu salvar. O guia funcionará nesta sessão.';}
    apply(preferences,warning);
    window.dispatchEvent(new CustomEvent(GUIDE_EVENT,{detail:{key:identity,preferences,warning}}));
  },[identity,apply]);
  const visible=snapshot.identity===identity?snapshot:{preferences:defaultGuidePreferences(),warning:''};
  return {preferences:visible.preferences,warning:visible.warning,update};
}
