import { requireSupabase } from '../lib/supabase';
export type MarketingCampaign = { id:string;title:string;body:string;state:string;created_at:string;counts:Record<string,number> };
export type MarketingDashboard = {
 settings:{enabled:boolean;consent_enabled:boolean;heartbeat_at:string|null;synced_at:string|null}|null;
 contacts:{phone:string;name:string;state:string;consent_at:string|null}[];
 campaigns:MarketingCampaign[];
 events:{id:number;kind:string;entity:string;created_at:string}[];
};
export type MarketingJob={id:string;phone:string;text:string;state:string;provider_id:string|null;result_code:string|null;finished_at:string|null};
export async function marketingAdmin<T>(storeId:string,operation:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await requireSupabase().rpc('bh_marketing_admin',{p_store_id:storeId,p_operation:operation,p_args:args});
 if(error)throw new Error('Não foi possível acessar o marketing. Confira a instalação e sua permissão de dono ou administrador.');
 return data as T;
}
export async function requestMarketingConsent(storeId:string,orderId:string):Promise<{state:string;challenge?:string;phone?:string}>{
 let accesses:{id:string;token:string}[]=[];
 try{accesses=JSON.parse(localStorage.getItem(`delivery:order-access:${storeId}`)||'[]');}catch{/* fail closed */}
 const access=Array.isArray(accesses)?accesses.find(x=>x.id===orderId):null;
 if(!access)throw new Error('Abra o pedido no navegador em que ele foi realizado para solicitar a inscrição.');
 const {data,error}=await requireSupabase().rpc('bh_marketing_request_consent',{p_store_id:storeId,p_order_id:orderId,p_access_token:access.token});
 if(error)throw new Error('A inscrição em promoções ainda não está disponível. Seu pedido continua normalmente.');
 return data;
}
export async function unsubscribeMarketing(storeId:string,token:string){
 const {error}=await requireSupabase().rpc('bh_marketing_unsubscribe',{p_store_id:storeId,p_token:token});
 if(error)throw new Error('Não foi possível confirmar o cancelamento. Tente novamente ou envie SAIR pelo WhatsApp da loja.');
}
