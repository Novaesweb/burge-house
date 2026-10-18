export type OrderStatus =
  | 'recebido'
  | 'preparando'
  | 'itens_separados'
  | 'esperando_motoboy'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado';

export type PaymentMethod = 'pix' | 'credit_card' | 'cash';

export interface OrderReview {
  foodRating: number;
  deliveryRating?: number;
  comment?: string;
  createdAt: string;
}

export interface StoreAdmin {
  id: string; // ID exclusivo do Administrador  (ex: owner-local)
  adminId: string;
  siteId: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'admin';
  roleLabel: string;
  pin: string;
  status: 'active' | 'inactive';
  permissions: string[];
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface SiteSettings {
  siteId: string;
  name: string;
  slug: string;
  ownerUid: string;
  ownerEmail: string;
  adminId?: string; // ID exclusivo do ADM 
  adminName?: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending_payment';
  blockReason?: string;
  paymentStatus: 'paid' | 'pending' | 'overdue';
  dueDate: string;
  plan: string;
  phone: string;
  address: string;
  openingHours: string;
  deliveryFee: number;
  isOpen: boolean;
  logoUrl: string;
  bannerUrl: string;
  customerNotice?: string;
  customerNoticeEnabled?: boolean;
  upsellEnabled?: boolean;
  upsellProductIds?: string[];
  primaryColor: string;
  acceptedPaymentMethods: PaymentMethod[];
  ownerPin?: string;
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreAvailability {
  status: 'active' | 'inactive' | 'suspended' | 'maintenance' | 'pending_payment' | 'archived' | string;
  blockMode?: string | null;
  message?: string | null;
  returnAt?: string | null;
}

export interface ManualPayment {
  id: string;
  siteId: string;
  amount: number;
  paymentMethod: 'pix' | 'credit_card' | 'cash';
  description: string;
  type?: 'income' | 'expense';
  category?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Category {
  id: string;
  siteId: string;
  name: string;
  imageUrl: string;
  icon?: string;
  order: number;
  isActive: boolean;
  bgColor?: string;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}

export interface SelectedAddon {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  siteId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
  isPopular?: boolean;
  hasMeatPoint?: boolean;
  removableIngredients?: string[];
  addons?: ProductAddon[];
  comboProductIds?: string[];
}

export interface CartItem {
  id?: string;
  product: Product;
  quantity: number;
  notes?: string;
  meatPoint?: string;
  removals?: string[];
  selectedAddons?: SelectedAddon[];
  itemUnitPrice?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  imageUrl?: string;
  meatPoint?: string;
  removals?: string[];
  selectedAddons?: SelectedAddon[];
}

export interface Order {
  id: string;
  siteId: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city?: string;
  };
  paymentMethod: PaymentMethod;
  paymentChange?: string;
  isPaid?: boolean;
  paymentStatus?: 'paid' | 'pending';
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  changeFor?: number;
  total: number;
  status: OrderStatus;
  notes?: string;
  estimatedMinutes?: number;
  review?: OrderReview;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  siteId: string;
  name: string;
  phone: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt?: string;
  createdAt: string;
}

export type TicketStatus = 'new' | 'in_progress' | 'waiting_client' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SupportMessage {
  id: string;
  sender: 'store_owner' | 'master';
  senderName: string;
  message: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  siteId: string;
  siteName: string;
  siteNxId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  updatedAt: string;
  createdAt: string;
  messages: SupportMessage[];
}

export interface MasterBroadcast {
  id: string;
  title: string;
  message: string;
  status: 'active' | 'inactive' | 'archived' | string;
  priority?: 'info' | 'warning' | 'alert' | 'urgent' | 'success' | string;
  createdAt?: string;
  source?: string;
  author?: string;
  targetNxId?: string;
  targetSiteId?: string;
  actionUrl?: string;
  actionText?: string;
}


