import * as local from './localStoreService';
import * as remote from './remoteStoreService';
import type { SiteSettings, Category, Product, Order, OrderStatus, Customer, ManualPayment, OrderReview, StoreAdmin, StoreAvailability, SupportTicket, SupportMessage } from '../types';
export * from './storeDefaults';
export { setConnectedStore } from './remoteStoreService';
export function getStoreSiteId(){const id=import.meta.env.VITE_NOVAESWEB_STORE_ID?.trim();return remote.connectedStore?.id||(id&&remote.isOfficialId(id)?id:local.DEFAULT_SITE_ID);}
export function getStoreAdminId(siteId=local.DEFAULT_SITE_ID){return local.getStoreAdminId(siteId);}
export const isRemoteStore=(siteId:string)=>remote.isOfficialId(siteId);
export async function initializeStoreData(siteId=getStoreSiteId()){if(isRemoteStore(siteId))await remote.initializeRemoteCatalog(siteId);}
export function subscribeSiteSettings(siteId:string,onData:(value:SiteSettings)=>void){return isRemoteStore(siteId)?remote.subscribeRemoteSettings(siteId,onData):local.subscribeSiteSettings(siteId,onData);}
export function subscribeStoreAvailability(siteId:string,onData:(value:StoreAvailability)=>void){
  if(isRemoteStore(siteId))return remote.subscribeRemoteAvailability(siteId,onData);
  return local.subscribeSiteSettings(siteId,settings=>onData({status:settings.status,message:settings.blockReason||null}));
}
export async function updateSiteSettings(siteId:string,data:Partial<SiteSettings>){return isRemoteStore(siteId)?remote.updateRemoteSettings(siteId,data):local.updateSiteSettings(siteId,data);}
export function subscribeCategories(siteId:string,onData:(value:Category[])=>void){return isRemoteStore(siteId)?remote.subscribeRemoteCategories(siteId,onData):local.subscribeCategories(siteId,onData);}
export async function saveCategory(siteId:string,data:Category){return isRemoteStore(siteId)?remote.saveRemoteCategory(siteId,data):local.saveCategory(siteId,data);}
export async function deleteCategory(siteId:string,id:string){return isRemoteStore(siteId)?remote.deleteRemoteCategory(siteId,id):local.deleteCategory(siteId,id);}
export function subscribeProducts(siteId:string,onData:(value:Product[])=>void){return isRemoteStore(siteId)?remote.subscribeRemoteProducts(siteId,onData):local.subscribeProducts(siteId,onData);}
export async function saveProduct(siteId:string,data:Product){return isRemoteStore(siteId)?remote.saveRemoteProduct(siteId,data):local.saveProduct(siteId,data);}
export async function deleteProduct(siteId:string,id:string){return isRemoteStore(siteId)?remote.deleteRemoteProduct(siteId,id):local.deleteProduct(siteId,id);}
export function subscribeOrders(siteId:string,onData:(value:Order[])=>void){return isRemoteStore(siteId)?remote.subscribeRemoteOrders(siteId,onData):local.subscribeOrders(siteId,onData);}
export async function createOrder(siteId:string,data:Omit<Order,'id'|'orderNumber'|'createdAt'|'updatedAt'>){return isRemoteStore(siteId)?remote.createRemoteOrder(siteId,data):local.createOrder(siteId,data);}
export async function updateOrderStatus(siteId:string,id:string,status:OrderStatus,expectedStatus?:string){return isRemoteStore(siteId)?remote.updateRemoteOrder(siteId,id,{status},expectedStatus):local.updateOrderStatus(siteId,id,status,expectedStatus);}
export async function updateOrderPaymentStatus(siteId:string,id:string,isPaid:boolean){return isRemoteStore(siteId)?remote.updateRemoteOrder(siteId,id,{is_paid:isPaid}):local.updateOrderPaymentStatus(siteId,id,isPaid);}
export async function submitOrderReview(siteId:string,id:string,review:OrderReview){return isRemoteStore(siteId)?remote.reviewRemoteOrder(siteId,id,review):local.submitOrderReview(siteId,id,review);}
export function subscribeCustomers(siteId:string,onData:(value:Customer[])=>void){return isRemoteStore(siteId)?remote.subscribeRemoteCustomers(siteId,onData):local.subscribeCustomers(siteId,onData);}
export function subscribeManualPayments(siteId:string,onData:(value:ManualPayment[])=>void){return isRemoteStore(siteId)?remote.subscribeRemotePayments(siteId,onData):local.subscribeManualPayments(siteId,onData);}
export async function addManualPayment(siteId:string,data:Omit<ManualPayment,'id'|'createdAt'>){return isRemoteStore(siteId)?remote.addRemotePayment(siteId,data):local.addManualPayment(siteId,data);}
export async function deleteManualPayment(siteId:string,id:string){return isRemoteStore(siteId)?remote.deleteRemotePayment(siteId,id):local.deleteManualPayment(siteId,id);}
export function subscribeStoreAdmin(siteId:string,adminId=local.DEFAULT_ADMIN_ID,onData:(value:StoreAdmin)=>void){
  if(!isRemoteStore(siteId))return local.subscribeStoreAdmin(siteId,adminId,onData);
  // Dados do proprietário são carregados somente em uma sessão vinculada à loja.
  // Clientes navegam o cardápio público sem consultar a conta administrativa.
  if(!remote.connectedStore || remote.connectedStore.id!==siteId)return()=>{};
  let active=true;void remote.remoteAdmin(siteId).then(data=>{if(active)onData(data);}).catch(remote.dataError);return()=>{active=false;};
}
export async function saveStoreAdmin(siteId:string,data:Partial<StoreAdmin>&{id:string}){return isRemoteStore(siteId)?remote.saveRemoteAdmin(siteId,data):local.saveStoreAdmin(siteId,data);}
// Master support has no operational contract in Connect 1.1; never pretend a message was delivered.
export function subscribeSupportTicket(_siteId:string,onData:(value:SupportTicket|null)=>void){onData(null);return()=>{};}
export async function sendSupportMessage(_siteId:string,_info:{name:string;ownerName:string;ownerEmail?:string;ownerPhone?:string;siteNxId?:string},_text:string):Promise<SupportMessage>{throw new Error('O suporte do Master ainda não oferece envio de mensagens para este delivery.');}
