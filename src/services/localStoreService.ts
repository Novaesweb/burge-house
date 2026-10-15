import type { SiteSettings, Category, Product, Order, OrderStatus, Customer, ManualPayment, OrderReview, StoreAdmin, SupportTicket, SupportMessage } from '../types';
import { readLocal, writeLocal, subscribeLocal } from '../lib/localStore';
import { DEFAULT_SITE_ID, DEFAULT_ADMIN_ID, DEFAULT_STORE_ADMIN, DEFAULT_SITE_SETTINGS, INITIAL_CATEGORIES, INITIAL_PRODUCTS } from './storeDefaults';
export * from './storeDefaults';

export function getStoreSiteId(): string { return new URLSearchParams(window.location.search).get('siteId')?.trim() || DEFAULT_SITE_ID; }
export function getStoreAdminId(_siteId = DEFAULT_SITE_ID): string { return DEFAULT_ADMIN_ID; }
const key = (siteId: string, resource: string) => `${siteId}:${resource}`;
const categoriesFor = (siteId: string) => INITIAL_CATEGORIES.map(item => ({ ...item, siteId }));
const productsFor = (siteId: string) => INITIAL_PRODUCTS.map(item => ({ ...item, siteId }));
export async function initializeStoreData(_siteId = getStoreSiteId()): Promise<void> {}
export function subscribeSiteSettings(siteId: string, onData: (value: SiteSettings) => void) {
  return subscribeLocal(key(siteId, 'settings'), { ...DEFAULT_SITE_SETTINGS, siteId }, onData);
}
export async function updateSiteSettings(siteId: string, settings: Partial<SiteSettings>): Promise<void> {
  writeLocal(key(siteId, 'settings'), { ...readLocal(key(siteId, 'settings'), { ...DEFAULT_SITE_SETTINGS, siteId }), ...settings, siteId });
}
export function subscribeCategories(siteId: string, onData: (value: Category[]) => void) { return subscribeLocal(key(siteId, 'categories'), categoriesFor(siteId), onData); }
export async function saveCategory(siteId: string, category: Category): Promise<void> {
  const list = readLocal(key(siteId, 'categories'), categoriesFor(siteId));
  writeLocal(key(siteId, 'categories'), [...list.filter(item => item.id !== category.id), { ...category, siteId }].sort((a,b) => a.order - b.order));
}
export async function deleteCategory(siteId: string, id: string): Promise<void> {
  writeLocal(key(siteId, 'categories'), readLocal(key(siteId, 'categories'), categoriesFor(siteId)).filter(item => item.id !== id));
}
export function subscribeProducts(siteId: string, onData: (value: Product[]) => void) { return subscribeLocal(key(siteId, 'products'), productsFor(siteId), onData); }
export async function saveProduct(siteId: string, product: Product): Promise<void> {
  const list = readLocal(key(siteId, 'products'), productsFor(siteId));
  writeLocal(key(siteId, 'products'), [...list.filter(item => item.id !== product.id), { ...product, siteId }]);
}
export async function deleteProduct(siteId: string, id: string): Promise<void> {
  writeLocal(key(siteId, 'products'), readLocal(key(siteId, 'products'), productsFor(siteId)).filter(item => item.id !== id));
}
export function subscribeOrders(siteId: string, onData: (value: Order[]) => void) { return subscribeLocal<Order[]>(key(siteId, 'orders'), [], onData); }
export async function createOrder(_siteId: string, _data: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Promise<Order> {
  throw new Error('Pedidos indisponíveis: conecte o novo banco de dados antes de receber pedidos.');
}
async function updateOrder(siteId: string, id: string, changes: Partial<Order>): Promise<void> {
  const list = readLocal<Order[]>(key(siteId, 'orders'), []);
  writeLocal(key(siteId, 'orders'), list.map(item => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item));
}
export async function updateOrderStatus(siteId: string, id: string, status: OrderStatus): Promise<void> { await updateOrder(siteId, id, { status }); }
export async function updateOrderPaymentStatus(siteId: string, id: string, isPaid: boolean): Promise<void> { await updateOrder(siteId, id, { isPaid, paymentStatus: isPaid ? 'paid' : 'pending' }); }
export async function submitOrderReview(siteId: string, id: string, review: OrderReview): Promise<void> { await updateOrder(siteId, id, { review }); }
export function subscribeCustomers(siteId: string, onData: (value: Customer[]) => void) { return subscribeLocal<Customer[]>(key(siteId, 'customers'), [], onData); }
export function subscribeManualPayments(siteId: string, onData: (value: ManualPayment[]) => void) { return subscribeLocal<ManualPayment[]>(key(siteId, 'payments'), [], onData); }
export async function addManualPayment(siteId: string, data: Omit<ManualPayment, 'id' | 'createdAt'>): Promise<ManualPayment> {
  const payment = { ...data, siteId, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  writeLocal(key(siteId, 'payments'), [...readLocal<ManualPayment[]>(key(siteId, 'payments'), []), payment]);
  return payment;
}
export async function deleteManualPayment(siteId: string, id: string): Promise<void> {
  writeLocal(key(siteId, 'payments'), readLocal<ManualPayment[]>(key(siteId, 'payments'), []).filter(item => item.id !== id));
}
export function subscribeStoreAdmin(siteId: string, adminId = DEFAULT_ADMIN_ID, onData: (value: StoreAdmin) => void) {
  return subscribeLocal(key(siteId, 'admin'), { ...DEFAULT_STORE_ADMIN, siteId, id: adminId, adminId }, onData);
}
export async function saveStoreAdmin(siteId: string, data: Partial<StoreAdmin> & { id: string }): Promise<void> {
  writeLocal(key(siteId, 'admin'), { ...readLocal(key(siteId, 'admin'), { ...DEFAULT_STORE_ADMIN, siteId }), ...data, siteId });
}
export function subscribeSupportTicket(_siteId: string, onData: (value: SupportTicket | null) => void): () => void { onData(null); return () => {}; }
export async function sendSupportMessage(_siteId: string, _info: { name: string; ownerName: string; ownerEmail?: string; ownerPhone?: string; siteNxId?: string }, _text: string): Promise<SupportMessage> {
  throw new Error('Suporte indisponível enquanto o novo banco de dados não estiver conectado.');
}

