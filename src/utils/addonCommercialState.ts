import type { AddonRequest, StoreAddon, CatalogAddon, AddonInstallation } from '../services/addonService';
export type CommercialGroup = 'available' | 'requested' | 'preparing' | 'active' | 'disabled';
export type CommercialState = { label: string; tone: 'active' | 'pending' | 'review' | 'rejected' | 'preparing' | 'disabled'; group: CommercialGroup; canRequest: boolean };
export function commercialState(request?: AddonRequest, subscription?: StoreAddon, addon?: CatalogAddon, installation?: AddonInstallation): CommercialState {
  const status=request?.status;
  if(subscription?.status==='suspended'||subscription?.status==='disabled')return{label:'Desativado pelo Master',tone:'disabled',group:'disabled',canRequest:false};
  if(subscription?.status==='active'){
    const service = addon?.category === 'service';
    if(!['approved','activated'].includes(status||'')||(!service && (addon?.development_status!=='ready'||installation?.technical_status!=='available')))return{label:'Aguardando revisão do Master',tone:'review',group:'disabled',canRequest:false};
    return{label:'Ativo',tone:'active',group:'active',canRequest:false};
  }
  if(status==='approved')return{label:'Em preparo',tone:'preparing',group:'preparing',canRequest:false};
  if(status==='pending')return{label:'Solicitado',tone:'pending',group:'requested',canRequest:false};
  if(status==='in_review')return{label:'Em análise',tone:'pending',group:'requested',canRequest:false};
  if(status==='awaiting_confirmation')return{label:'Aguardando confirmação',tone:'pending',group:'requested',canRequest:false};
  if(status==='rejected')return{label:'Recusado',tone:'rejected',group:'disabled',canRequest:false};
  if(status==='cancelled')return{label:'Solicitação cancelada',tone:'disabled',group:'disabled',canRequest:false};
  if(status||subscription)return{label:'Aguardando revisão do Master',tone:'review',group:'disabled',canRequest:false};
  return{label:'Disponível para solicitação',tone:'review',group:'available',canRequest:true};
}
export function isNewAddon(createdAt:string,now=Date.now()) {
  const age=now-Date.parse(createdAt);
  return Number.isFinite(age)&&age>=0&&age<=7*24*60*60*1000;
}
