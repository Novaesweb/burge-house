import { requireSupabase } from '../lib/supabase';
import type { Category, Product, SiteSettings, Order, Customer, ManualPayment, OrderReview, StoreAdmin } from '../types';
import { DEFAULT_SITE_SETTINGS, DEFAULT_STORE_ADMIN, INITIAL_CATEGORIES, INITIAL_PRODUCTS, DEFAULT_SITE_ID } from './storeDefaults';
import { readLocal } from '../lib/localStore';
import type { OfficialStore } from './connectService';

export let connectedStore: OfficialStore | null = null;
export function setConnectedStore(value: OfficialStore | null) { connectedStore = value; }
export const isOfficialId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const change = 'delivery-remote-change';
export function dataError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Não foi possível atualizar os dados da loja. Confira a conexão.';
  window.dispatchEvent(new CustomEvent('delivery-data-error',{detail:message}));
}
function assertResult(error: {message:string} | null) {
  if (error) throw new Error(error.message.includes('permission') || error.message.includes('row-level') ? 'Sua conta não tem permissão para alterar estes dados.' : 'Não foi possível salvar no banco. Confira a conexão e suas permissões.');
}
const notify = () => window.dispatchEvent(new Event(change));
function withoutSite<T extends {siteId:string}>(item:T) { const {siteId:_siteId,...payload}=item;return payload; }

export function subscribeRemote<T>(siteId:string, table:string, fetcher:()=>Promise<T>, onData:(value:T)=>void, interval=30_000):()=>void {
  let active=true;let fetching=false;
  const refresh=async()=>{if(!active||fetching)return;fetching=true;try{const value=await fetcher();if(active)onData(value);}catch(error){if(active)dataError(error);}finally{fetching=false;}};
  const client=requireSupabase();
  const channel=client.channel(`delivery:${table}:${siteId}:${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table,filter:`store_id=eq.${siteId}`},()=>void refresh()).subscribe();
  const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener(change,onVisible);document.addEventListener('visibilitychange',onVisible);
  const timer=window.setInterval(onVisible,interval);void refresh();
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener(change,onVisible);document.removeEventListener('visibilitychange',onVisible);void client.removeChannel(channel);};
}

const publicSettingsKeys=['name','slug','phone','address','openingHours','deliveryFee','isOpen','logoUrl','bannerUrl','primaryColor','acceptedPaymentMethods','pixKey','pixKeyType'] as const;
export function publicSettings(settings:Partial<SiteSettings>) { return Object.fromEntries(publicSettingsKeys.filter(key=>settings[key]!==undefined).map(key=>[key,settings[key]])); }
export async function initializeRemoteCatalog(siteId:string) {
  if (!connectedStore || connectedStore.id!==siteId || !['owner','admin'].includes(connectedStore.role)) return;
  const client=requireSupabase();
  const marker=`novaesweb:catalog-imported:${siteId}`;
  if(localStorage.getItem(marker)==='yes')return;
  // A catalogue created during official provisioning must never be mixed with
  // the old local sample catalogue when the owner signs in for the first time.
  const { data: existingSettings, error: settingsError } = await client.from('delivery_settings').select('store_id').eq('store_id',siteId).maybeSingle();
  assertResult(settingsError);
  if (existingSettings) { localStorage.setItem(marker,'yes'); return; }
  // Import the preserved catalogue only. No customer/order/payment history is copied.
  const categories=readLocal<Category[]>(`${DEFAULT_SITE_ID}:categories`,INITIAL_CATEGORIES);
  const products=readLocal<Product[]>(`${DEFAULT_SITE_ID}:products`,INITIAL_PRODUCTS);
  const settings=readLocal(`${DEFAULT_SITE_ID}:settings`,DEFAULT_SITE_SETTINGS);
  const {error}=await client.rpc('delivery_import_catalog',{p_store_id:siteId,p_settings:publicSettings(settings),p_categories:categories.map(withoutSite),p_products:products.map(withoutSite)});
  assertResult(error);localStorage.setItem(marker,'yes');notify();
}
export function subscribeRemoteSettings(siteId:string,onData:(value:SiteSettings)=>void) {
  return subscribeRemote(siteId,'delivery_settings',async()=>{
    const {data,error}=await requireSupabase().from('delivery_settings').select('payload').eq('store_id',siteId).maybeSingle();assertResult(error);
    if(!data)throw new Error('A loja está indisponível ou o catálogo ainda não foi importado.');
    return {...DEFAULT_SITE_SETTINGS,...data.payload,siteId,ownerUid:'',ownerEmail:'',adminId:undefined,adminName:undefined,ownerPin:undefined,status:'active'} as SiteSettings;
  },onData);
}
export async function updateRemoteSettings(siteId:string,settings:Partial<SiteSettings>) {
  const client=requireSupabase();const {data,error}=await client.from('delivery_settings').select('payload').eq('store_id',siteId).single();assertResult(error);
  const result=await client.from('delivery_settings').update({payload:{...data?.payload,...publicSettings(settings)}}).eq('store_id',siteId).select('store_id').single();assertResult(result.error);notify();
}
export function subscribeRemoteCategories(siteId:string,onData:(value:Category[])=>void){return subscribeRemote(siteId,'delivery_categories',async()=>{
  const {data,error}=await requireSupabase().from('delivery_categories').select('id,payload,is_active').eq('store_id',siteId);assertResult(error);
  return (data||[]).map(row=>({...row.payload,id:row.id,siteId,isActive:row.is_active} as Category)).sort((a,b)=>a.order-b.order);
},onData);}
export async function saveRemoteCategory(siteId:string,item:Category){const {error}=await requireSupabase().from('delivery_categories').upsert({store_id:siteId,id:item.id,payload:withoutSite(item),is_active:item.isActive},{onConflict:'store_id,id'});assertResult(error);notify();}
export async function deleteRemoteCategory(siteId:string,id:string){const {error}=await requireSupabase().from('delivery_categories').delete().eq('store_id',siteId).eq('id',id).select('id').single();assertResult(error);notify();}
export function subscribeRemoteProducts(siteId:string,onData:(value:Product[])=>void){return subscribeRemote(siteId,'delivery_products',async()=>{
  const {data,error}=await requireSupabase().from('delivery_products').select('id,category_id,payload,price_cents,is_active').eq('store_id',siteId);assertResult(error);
  return(data||[]).map(row=>({...row.payload,id:row.id,siteId,categoryId:row.category_id,price:Number(row.price_cents)/100,isActive:row.is_active} as Product));
},onData);}
export async function saveRemoteProduct(siteId:string,item:Product){
  if(!Number.isFinite(item.price)||item.price<0)throw new Error('Informe um preço válido.');
  const {price:_price,...payload}=withoutSite(item);
  const {error}=await requireSupabase().from('delivery_products').upsert({store_id:siteId,id:item.id,category_id:item.categoryId,payload,price_cents:Math.round(item.price*100),is_active:item.isActive},{onConflict:'store_id,id'});assertResult(error);notify();
}
export async function deleteRemoteProduct(siteId:string,id:string){const {error}=await requireSupabase().from('delivery_products').delete().eq('store_id',siteId).eq('id',id).select('id').single();assertResult(error);notify();}

type GuestOrder={id:string;token:string};
function guestOrders(siteId:string):GuestOrder[]{try{return JSON.parse(localStorage.getItem(`delivery:order-access:${siteId}`)||'[]');}catch{return [];}}
function mapOrder(row:Record<string,any>):Order{return {...row.payload,id:row.id,siteId:row.store_id,orderNumber:Number(row.order_number),total:Number(row.total_cents)/100,status:row.status,isPaid:row.is_paid,paymentStatus:row.is_paid?'paid':'pending',createdAt:row.created_at,updatedAt:row.updated_at};}
export function subscribeRemoteOrders(siteId:string,onData:(value:Order[])=>void){return subscribeRemote(siteId,'delivery_orders',async()=>{
  const client=requireSupabase();
  if(connectedStore?.id===siteId){const {data,error}=await client.from('delivery_orders').select('*').eq('store_id',siteId).order('created_at',{ascending:false});assertResult(error);return(data||[]).map(mapOrder);}
  const list:Order[]=[];
  for(const access of guestOrders(siteId).slice(0,50)){
    const {data,error}=await client.rpc('delivery_track_order',{p_store_id:siteId,p_order_id:access.id,p_access_token:access.token});
    if(error)throw new Error('Não foi possível atualizar seus pedidos. Tente novamente.');if(data)list.push(data as Order);
  }
  return list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
},onData,10_000);}
export async function createRemoteOrder(siteId:string,order:Omit<Order,'id'|'orderNumber'|'createdAt'|'updatedAt'>):Promise<Order>{
  const request={customerName:order.customerName,customerPhone:order.customerPhone,deliveryAddress:order.deliveryAddress,paymentMethod:order.paymentMethod,paymentChange:order.paymentChange,notes:order.notes,items:order.items.map(item=>({productId:item.productId,quantity:item.quantity,notes:item.notes,meatPoint:item.meatPoint,removals:item.removals,selectedAddons:item.selectedAddons?.map(addon=>({id:addon.id}))}))};
  const serialized=JSON.stringify(request);const attemptKey=`delivery:checkout-attempt:${siteId}`;
  let saved: {request:string;key:string;token:string}|null=null;
  try{saved=JSON.parse(localStorage.getItem(attemptKey)||'null');}catch{}
  const attempt=saved?.request===serialized?saved:{request:serialized,key:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')};
  localStorage.setItem(attemptKey,JSON.stringify(attempt));
  const {data,error}=await requireSupabase().rpc('delivery_place_order',{p_store_id:siteId,p_request:request,p_idempotency_key:attempt.key,p_access_token:attempt.token});
  if(error){const messages:Record<string,string>={
    STORE_UNAVAILABLE:'A loja está indisponível.',
    STORE_CLOSED:'A loja está fechada no momento.',
    PRODUCT_UNAVAILABLE:'Um item do carrinho não está mais disponível. Remova-o e adicione-o novamente.',
    ORDER_RATE_LIMIT:'Aguarde alguns minutos antes de enviar outro pedido.',
    INVALID_PAYMENT:'Escolha uma forma de pagamento aceita pela loja.',
    INVALID_CUSTOMER:'Informe seu nome completo.',
    INVALID_PHONE:'Informe um telefone com DDD e número.',
    INVALID_ADDRESS_OR_NOTES:'Complete rua, número e bairro para a entrega.',
    INVALID_ITEMS:'Adicione pelo menos um item ao carrinho.',
    INVALID_QUANTITY:'A quantidade de um item não é válida.',
    ORDER_TOO_LARGE:'O pedido ultrapassa o limite permitido. Reduza as quantidades e tente novamente.',
  };throw new Error(messages[error.message]||'Não foi possível confirmar o pedido. Confira os dados e tente novamente.');}
  const result=data as Order;
  if(!result?.id)throw new Error('O banco não confirmou seu pedido.');
  const accesses=guestOrders(siteId);localStorage.setItem(`delivery:order-access:${siteId}`,JSON.stringify([{id:result.id,token:attempt.token},...accesses.filter(item=>item.id!==result.id)].slice(0,50)));
  localStorage.removeItem(attemptKey);notify();return result;
}
export async function updateRemoteOrder(siteId:string,id:string,changes:{status?:string;is_paid?:boolean}){const {error}=await requireSupabase().from('delivery_orders').update(changes).eq('store_id',siteId).eq('id',id).select('id').single();assertResult(error);notify();}
export async function reviewRemoteOrder(siteId:string,id:string,review:OrderReview){const access=guestOrders(siteId).find(item=>item.id===id);if(!access)throw new Error('Este navegador não tem acesso a esse pedido.');const{error}=await requireSupabase().rpc('delivery_review_order',{p_store_id:siteId,p_order_id:id,p_access_token:access.token,p_review:review});assertResult(error);notify();}
export function subscribeRemoteCustomers(siteId:string,onData:(value:Customer[])=>void){return subscribeRemote(siteId,'delivery_customers',async()=>{
  if(connectedStore?.id!==siteId)return[];const{data,error}=await requireSupabase().from('delivery_customers').select('id,payload,created_at').eq('store_id',siteId);assertResult(error);return(data||[]).map(row=>({...row.payload,id:row.id,siteId,createdAt:row.created_at} as Customer));
},onData);}
export function subscribeRemotePayments(siteId:string,onData:(value:ManualPayment[])=>void){return subscribeRemote(siteId,'delivery_manual_payments',async()=>{
  if(connectedStore?.id!==siteId||!['owner','admin'].includes(connectedStore.role))return[];const{data,error}=await requireSupabase().from('delivery_manual_payments').select('id,payload,created_at').eq('store_id',siteId);assertResult(error);return(data||[]).map(row=>({...row.payload,id:row.id,siteId,createdAt:row.created_at} as ManualPayment));
},onData);}
export async function addRemotePayment(siteId:string,payment:Omit<ManualPayment,'id'|'createdAt'>){const id=crypto.randomUUID();const{data,error}=await requireSupabase().from('delivery_manual_payments').insert({store_id:siteId,id,payload:withoutSite({...payment,siteId})}).select('id,created_at').single();assertResult(error);notify();return{...payment,siteId,id,createdAt:data!.created_at};}
export async function deleteRemotePayment(siteId:string,id:string){const{error}=await requireSupabase().from('delivery_manual_payments').delete().eq('store_id',siteId).eq('id',id).select('id').single();assertResult(error);notify();}
export async function remoteAdmin(siteId:string):Promise<StoreAdmin>{const{data:{user},error}=await requireSupabase().auth.getUser();if(error||!user)throw new Error('Sessão expirada.');return{...DEFAULT_STORE_ADMIN,id:user.id,adminId:user.id,siteId,name:user.user_metadata?.display_name||user.email?.split('@')[0]||'Proprietário',email:user.email||'',pin:'',role:connectedStore?.role==='owner'?'owner':'admin',permissions:connectedStore?.role==='viewer'?['read']:['all']};}
export async function saveRemoteAdmin(_siteId:string,data:Partial<StoreAdmin>){const{error}=await requireSupabase().auth.updateUser({data:{display_name:data.name}});assertResult(error);notify();}
