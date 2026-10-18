import { useConnect } from './ConnectContext';
import { setConnectedStore, isRemoteStore } from '../services/storeService';
import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  SiteSettings,
  Category,
  Product,
  Order,
  Customer,
  CartItem,
  OrderStatus,
  ManualPayment,
  SelectedAddon,
  OrderReview,
  StoreAdmin,
  StoreAvailability,
  SupportTicket,
  SupportMessage,
} from '../types';
import {
  DEFAULT_SITE_ID,
  getStoreSiteId,
  DEFAULT_ADMIN_ID,
  DEFAULT_STORE_ADMIN,
  subscribeStoreAdmin,
  saveStoreAdmin,
  getStoreAdminId,
  DEFAULT_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  initializeStoreData,
  subscribeSiteSettings,
  subscribeStoreAvailability,
  updateSiteSettings,
  subscribeCategories,
  saveCategory,
  deleteCategory,
  subscribeProducts,
  saveProduct,
  deleteProduct,
  subscribeOrders,
  createOrder,
  updateOrderStatus,
  updateOrderPaymentStatus,
  subscribeCustomers,
  subscribeManualPayments,
  addManualPayment,
  deleteManualPayment,
  submitOrderReview,
  subscribeSupportTicket,
  sendSupportMessage,
} from '../services/storeService';
import { playUrgentOrderSound } from '../utils/audioAlert';

export type CustomerView =
  | 'home'
  | 'categories'
  | 'products'
  | 'cart'
  | 'checkout'
  | 'order-status'
  | 'order-delivered'
  | 'my-orders';

export type AdminView =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'categories'
  | 'customers'
  | 'sales'
  | 'reports'
  | 'reviews'
  | 'settings'
  | 'support'
  | 'extras';

interface StoreContextType {
  siteId: string;
  setSiteId: (id: string) => void;
  siteSettings: SiteSettings;
  storeAvailability: StoreAvailability;
  categories: Category[];
  products: Product[];
  orders: Order[];
  customers: Customer[];
  isLoading: boolean;

  // View state
  appMode: 'customer' | 'admin';
  setAppMode: (mode: 'customer' | 'admin') => void;
  customerView: CustomerView;
  setCustomerView: (view: CustomerView) => void;
  adminView: AdminView;
  setAdminView: (view: AdminView) => void;

  // Support & Master Panel Chat
  supportTicket: SupportTicket | null;
  sendSupportMessageAction: (text: string) => Promise<void>;

  // Manual Payments / Faturamento
  manualPayments: ManualPayment[];
  addManualPaymentAction: (payment: Omit<ManualPayment, 'id' | 'createdAt'>) => Promise<void>;
  deleteManualPaymentAction: (paymentId: string) => Promise<void>;

  // Navigation / Selection
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  selectedProductForModal: Product | null;
  setSelectedProductForModal: (p: Product | null) => void;
  activeOrder: Order | null;
  setActiveOrder: (order: Order | null) => void;

  // Cart & Toast
  cart: CartItem[];
  cartToast: {
    id: string;
    productName: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  } | null;
  setCartToast: (toast: {
    id: string;
    productName: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  } | null) => void;
  addToCart: (
    product: Product,
    quantity?: number,
    notes?: string,
    customization?: {
      meatPoint?: string;
      removals?: string[];
      selectedAddons?: SelectedAddon[];
    }
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  cartTotal: number;

  // Checkout
  handleCheckoutOrder: (orderData: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
    };
    paymentMethod: 'pix' | 'credit_card' | 'cash';
    paymentChange?: string;
    notes?: string;
  }) => Promise<Order>;

  createManualOrderAction: (order: Omit<Order,'id'|'orderNumber'|'createdAt'|'updatedAt'>) => Promise<Order>;

  // Admin actions & local ADM Identification
  adminId: string;
  storeAdmin: StoreAdmin;
  updateStoreAdminAction: (data: Partial<StoreAdmin>) => Promise<void>;
  ownerName: string;
  isOwnerAuthenticated: boolean;
  isOwnerLoginModalOpen: boolean;
  setIsOwnerLoginModalOpen: (open: boolean) => void;
  loginOwner: (name: string, pin: string) => boolean;
  logoutOwner: () => void;
  changeOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  toggleOrderPaymentAction: (orderId: string, isPaid: boolean) => Promise<void>;
  saveProductAction: (product: Product) => Promise<void>;
  deleteProductAction: (productId: string) => Promise<void>;
  saveCategoryAction: (category: Category) => Promise<void>;
  deleteCategoryAction: (categoryId: string) => Promise<void>;
  updateSettingsAction: (settings: Partial<SiteSettings>) => Promise<void>;
  submitOrderReviewAction: (orderId: string, review: OrderReview) => Promise<void>;
  selectedAdminOrder: Order | null;
  setSelectedAdminOrder: (order: Order | null) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connection = useConnect();
  const [dataError, setDataError] = useState('');
  const [siteId, setSiteId] = useState<string>(() => getStoreSiteId());
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [storeAvailability, setStoreAvailability] = useState<StoreAvailability>({ status: 'active' });
  const [adminId, setAdminId] = useState<string>(() => getStoreAdminId(getStoreSiteId()));
  const [storeAdmin, setStoreAdmin] = useState<StoreAdmin>(DEFAULT_STORE_ADMIN);
  // A loja oficial nunca mostra o catálogo de demonstração enquanto o catálogo
  // próprio ainda não foi importado. Assim nenhum pedido usa produtos de outra loja.
  const [categories, setCategories] = useState<Category[]>(() => isRemoteStore(getStoreSiteId()) ? [] : INITIAL_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(() => isRemoteStore(getStoreSiteId()) ? [] : INITIAL_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
  const [supportTicket, setSupportTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // App mode & subviews ('customer' | 'admin')
  const [appMode, setAppMode] = useState<'customer' | 'admin'>('customer');
  const [customerView, setCustomerView] = useState<CustomerView>('home');
  const [adminView, setAdminView] = useState<AdminView>('dashboard');

  const addManualPaymentAction = async (payment: Omit<ManualPayment, 'id' | 'createdAt'>) => {
    await addManualPayment(siteId, payment);
  };

  const deleteManualPaymentAction = async (paymentId: string) => {
    await deleteManualPayment(siteId, paymentId);
  };

  const ownerName = storeAdmin.name || connection.session?.user.email || 'Proprietário';
  const isOwnerAuthenticated = Boolean(connection.session && connection.store);
  const [isOwnerLoginModalOpen,setIsOwnerLoginModalOpen] = useState(false);
  const loginOwner = (_name: string,_pin: string): boolean => false;
  const logoutOwner = () => { void connection.signOut(); };
  useEffect(() => {
    setConnectedStore(connection.store);
    setSiteId(getStoreSiteId());
    setOrders([]); setCustomers([]); setManualPayments([]); setActiveOrder(null);
    setDataError('');
  },[connection.store?.id,connection.store?.role,connection.session?.user.id]);
  useEffect(() => {
    const onError=(event:Event)=>setDataError((event as CustomEvent<string>).detail);
    window.addEventListener('delivery-data-error',onError);
    return()=>window.removeEventListener('delivery-data-error',onError);
  },[]);
  // Selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [selectedAdminOrder, setSelectedAdminOrder] = useState<Order | null>(null);

  // Cart State with persistent localStorage scoped to siteId
  const [cart, setCart] = useState<CartItem[]>(() => {
    const currentId = getStoreSiteId();
    const saved = localStorage.getItem(`shopping_cart_${currentId}`) || localStorage.getItem('shopping_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [cartToast, setCartToast] = useState<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  } | null>(null);

  // Auto-dismiss cart toast after 3 seconds
  useEffect(() => {
    if (cartToast) {
      const timer = setTimeout(() => setCartToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [cartToast]);

  // Persist cart scoped to store siteId
  useEffect(() => {
    localStorage.setItem(`shopping_cart_${siteId}`, JSON.stringify(cart));
  }, [cart, siteId]);

  // Bootstrap & Listeners
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // 1. Immediately subscribe to armazenamento local realtime streams
    try {
      unsubs.push(
        subscribeSiteSettings(siteId, (settings) => {
          if (settings) {
            setSiteSettings(settings);
          }
        })
      );

      unsubs.push(
        subscribeStoreAvailability(siteId, (availability) => {
          setStoreAvailability(availability);
        })
      );

      unsubs.push(
        subscribeCategories(siteId, (cats) => {
          if (cats) {
            setCategories(cats);
          }
        })
      );

      unsubs.push(
        subscribeProducts(siteId, (prods) => {
          if (prods) {
            setProducts(prods);
            // Itens de um catálogo anterior não podem chegar ao checkout.
            // O cliente vê o aviso para adicioná-los novamente com o cardápio atual.
            setCart((current) => current.filter((item) =>
              prods.some((product) => product.id === item.product.id && product.isActive !== false)
            ));
          }
        })
      );

      unsubs.push(
        subscribeOrders(siteId, (data) => {
          setOrders(data);
          if (activeOrder) {
            const freshActive = data.find((o) => o.id === activeOrder.id);
            if (freshActive) {
              setActiveOrder(freshActive);
            }
          }
        })
      );

      unsubs.push(
        subscribeCustomers(siteId, (custs) => {
          if (custs) {
            setCustomers(custs);
          }
        })
      );

      unsubs.push(
        subscribeManualPayments(siteId, (payments) => {
          if (payments) {
            setManualPayments(payments);
          }
        })
      );

      unsubs.push(
        subscribeStoreAdmin(siteId, adminId, (adm) => {
          if (adm) {
            setStoreAdmin(adm);
            if (adm.id && adm.id !== adminId) {
              setAdminId(adm.id);
            }
          }
        })
      );

      unsubs.push(
        subscribeSupportTicket(siteId, (ticket) => {
          setSupportTicket(ticket);
        })
      );
    } catch (err) {
      console.error('Error attaching store listeners:', err);
    }

    // 2. Ensure initial seed runs asynchronously in background without blocking UI
    initializeStoreData(siteId).catch((err) => {
      console.warn('Background seed notice:', err);
    });

    return () => {
      unsubs.forEach((u) => u?.());
    };
  }, [siteId, connection.store?.id, connection.session?.user.id]);

  // Sync active order if orders list changes
  useEffect(() => {
    if (activeOrder?.id) {
      const found = orders.find((o) => o.id === activeOrder.id);
      if (found && (found.status !== activeOrder.status || found.updatedAt !== activeOrder.updatedAt)) {
        setActiveOrder(found);
      }
    }
  }, [orders, activeOrder?.id, activeOrder?.status, activeOrder?.updatedAt]);

  // Cart operations
  const addToCart = (
    product: Product,
    quantity = 1,
    notes = '',
    customization?: {
      meatPoint?: string;
      removals?: string[];
      selectedAddons?: SelectedAddon[];
    }
  ) => {
    const addonsTotal = customization?.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0;
    const finalUnitPrice = product.price + addonsTotal;

    const cartItemId = `${product.id}-${customization?.meatPoint || 'default'}-${(customization?.removals || []).sort().join(',')}-${(customization?.selectedAddons || []).map((a) => a.id).sort().join(',')}-${notes.trim()}`;

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex((item) => item.id === cartItemId);

      if (existingItemIndex > -1) {
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += quantity;
        return updatedCart;
      } else {
        return [
          ...prevCart,
          {
            id: cartItemId,
            product,
            quantity,
            notes,
            meatPoint: customization?.meatPoint,
            removals: customization?.removals,
            selectedAddons: customization?.selectedAddons,
            itemUnitPrice: finalUnitPrice,
          },
        ];
      }
    });

    setCartToast({
      id: `toast-${Date.now()}`,
      productName: product.name,
      quantity,
      price: finalUnitPrice * quantity,
      imageUrl: product.imageUrl,
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const updateCartQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === cartItemId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const unit = typeof item.itemUnitPrice === 'number' ? item.itemUnitPrice : item.product.price;
      return total + unit * item.quantity;
    }, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    const deliveryFee = typeof siteSettings?.deliveryFee === 'number' ? siteSettings.deliveryFee : 5.0;
    return cartSubtotal + deliveryFee;
  }, [cartSubtotal, siteSettings.deliveryFee]);

  // Checkout flow
  const handleCheckoutOrder = async (orderData: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
    };
    paymentMethod: 'pix' | 'credit_card' | 'cash';
    paymentChange?: string;
    notes?: string;
  }): Promise<Order> => {
    if (cart.length === 0) {
      throw new Error('Seu carrinho foi atualizado. Adicione um item do cardápio para continuar.');
    }
    const items = cart.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      price: typeof item.itemUnitPrice === 'number' ? item.itemUnitPrice : item.product.price,
      quantity: item.quantity,
      notes: item.notes,
      imageUrl: item.product.imageUrl,
      meatPoint: item.meatPoint,
      removals: item.removals,
      selectedAddons: item.selectedAddons,
    }));

    const newOrder = await createOrder(siteId, {
      siteId,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      deliveryAddress: orderData.deliveryAddress,
      paymentMethod: orderData.paymentMethod,
      paymentChange: orderData.paymentChange,
      items,
      subtotal: cartSubtotal,
      deliveryFee: siteSettings.deliveryFee ?? 5.0,
      total: cartTotal,
      status: 'recebido',
      isPaid: false,
      paymentStatus: 'pending',
      notes: orderData.notes,
      estimatedMinutes: 40,
    });

    setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
    setActiveOrder(newOrder);
    clearCart();
    setCustomerView('order-status');
    return newOrder;
  };

  const createManualOrderAction = async (order: Omit<Order,'id'|'orderNumber'|'createdAt'|'updatedAt'>) => {
    if (!isOwnerAuthenticated) throw new Error('Entre no painel para cadastrar pedidos.');
    const created = await createOrder(siteId, order);
    setOrders(prev => [created,...prev.filter(item=>item.id!==created.id)]);
    return created;
  };

  // Change order status from Store Admin
  const changeOrderStatus = async (
    orderId: string,
    status: OrderStatus
  ) => {
    await updateOrderStatus(siteId, orderId, status);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
    if (activeOrder && activeOrder.id === orderId) {
      setActiveOrder((prev) => (prev ? { ...prev, status } : null));
    }
  };

  const toggleOrderPaymentAction = async (orderId: string, isPaid: boolean) => {
    await updateOrderPaymentStatus(siteId, orderId, isPaid);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, isPaid, paymentStatus: isPaid ? 'paid' : 'pending' } : o
      )
    );
    if (activeOrder && activeOrder.id === orderId) {
      setActiveOrder((prev) =>
        prev ? { ...prev, isPaid, paymentStatus: isPaid ? 'paid' : 'pending' } : null
      );
    }
  };

  const saveProductAction = async (product: Product) => {
    await saveProduct(siteId, product);
  };

  const deleteProductAction = async (productId: string) => {
    await deleteProduct(siteId, productId);
  };

  const saveCategoryAction = async (category: Category) => {
    await saveCategory(siteId, category);
  };

  const deleteCategoryAction = async (categoryId: string) => {
    await deleteCategory(siteId, categoryId);
  };

  const updateSettingsAction = async (newSettings: Partial<SiteSettings>) => {
    await updateSiteSettings(siteId, newSettings);
    setSiteSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const submitOrderReviewAction = async (orderId: string, review: OrderReview) => {
    await submitOrderReview(siteId, orderId, review);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, review } : o))
    );
    if (activeOrder?.id === orderId) {
      setActiveOrder((prev) => (prev ? { ...prev, review } : null));
    }
  };

  const updateStoreAdminAction = async (data: Partial<StoreAdmin>) => {
    const updated = {
      ...storeAdmin,
      ...data,
      id: adminId,
    };
    await saveStoreAdmin(siteId, updated);
    setStoreAdmin(updated);
  };

  const sendSupportMessageAction = async (_text: string) => { throw new Error('Envio de suporte indisponível no contrato atual do Master.'); };

  return (
    <StoreContext.Provider
      value={{
        siteId,
        setSiteId,
        adminId,
        storeAdmin,
        updateStoreAdminAction,
        siteSettings,
        storeAvailability,
        categories,
        products,
        orders,
        customers,
        isLoading,
        appMode,
        setAppMode,
        customerView,
        setCustomerView,
        adminView,
        setAdminView,
        supportTicket,
        sendSupportMessageAction,
        manualPayments,
        addManualPaymentAction,
        createManualOrderAction,
        deleteManualPaymentAction,
        selectedCategoryId,
        setSelectedCategoryId,
        selectedProductForModal,
        setSelectedProductForModal,
        activeOrder,
        setActiveOrder,
        cart,
        cartToast,
        setCartToast,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
        cartTotal,
        handleCheckoutOrder,
        ownerName,
        isOwnerAuthenticated,
        isOwnerLoginModalOpen,
        setIsOwnerLoginModalOpen,
        loginOwner,
        logoutOwner,
        changeOrderStatus,
        toggleOrderPaymentAction,
        saveProductAction,
        deleteProductAction,
        saveCategoryAction,
        deleteCategoryAction,
        updateSettingsAction,
        submitOrderReviewAction,
        selectedAdminOrder,
        setSelectedAdminOrder,
      }}
    >
      {dataError && <div role="alert" className="delivery-data-error">{dataError} <button onClick={() => setDataError('')}>Fechar aviso</button></div>}
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};





