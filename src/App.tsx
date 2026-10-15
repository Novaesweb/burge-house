import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { Banner } from './components/Banner';
import { CategorySquares } from './components/CategorySquares';
import { ProductList } from './components/ProductList';
import { ProductModal } from './components/ProductModal';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { OrderStatusView } from './components/OrderStatusView';
import { DeliveredView } from './components/DeliveredView';
import { CustomerOrdersView } from './components/CustomerOrdersView';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { AudioNotificationBanner } from './components/AudioNotificationBanner';
import { CartToastNotification } from './components/CartToastNotification';
import { SiteSuspendedScreen } from './components/SiteSuspendedScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useConnect } from './context/ConnectContext';
import { ConnectGate } from './components/admin/ConnectGate';
import { PasswordSetupGate } from './components/admin/PasswordSetupGate';

// Admin Components
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminOrders } from './components/admin/AdminOrders';
import { AdminProducts } from './components/admin/AdminProducts';
import { AdminCategories } from './components/admin/AdminCategories';
import { AdminCustomers } from './components/admin/AdminCustomers';
import { AdminSales } from './components/admin/AdminSales';
import { AdminReports } from './components/admin/AdminReports';
import { AdminSettings } from './components/admin/AdminSettings';
import { AdminSupport } from './components/admin/AdminSupport';

interface DeliveryAppContentProps {
  isAdmDonoRoute: boolean;
}

const DeliveryAppContent: React.FC<DeliveryAppContentProps> = ({
  isAdmDonoRoute,
}) => {
  const connection = useConnect();
  const {
    customerView,
    setCustomerView,
    adminView,
    siteSettings,
    categories,
    isOwnerAuthenticated,
    isLoading,
  } = useStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4 p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center animate-pulse shadow-xl shadow-red-950/60">
          <span className="text-2xl">🍔</span>
        </div>
        <p className="text-sm font-semibold text-neutral-400">Carregando Burger House...</p>
      </div>
    );
  }

  // 1. IF SITE IS SUSPENDED OR INACTIVE BY PLATFORM ADMIN (Blocking Guard)
  if (siteSettings.status === 'suspended' || siteSettings.status === 'inactive') {
    return <SiteSuspendedScreen />;
  }

  // 2. ROUTE /admdono - EXCLUSIVE OWNER ADMIN PORTAL
  if (isAdmDonoRoute) {
    if (connection.recoveryMode) return <PasswordSetupGate />;
    if (connection.loading || !connection.session || !connection.store) return <ConnectGate />;
    return (
      <AdminLayout>
        <AudioNotificationBanner />
        {adminView === 'dashboard' && <AdminDashboard />}
        {adminView === 'orders' && <AdminOrders />}
        {adminView === 'products' && <AdminProducts />}
        {adminView === 'categories' && <AdminCategories />}
        {adminView === 'customers' && <AdminCustomers />}
        {adminView === 'sales' && <AdminSales />}
        {adminView === 'reports' && <AdminReports />}
        {adminView === 'settings' && <AdminSettings />}
        {adminView === 'support' && <AdminSupport />}
      </AdminLayout>
    );
  }

  // 3. PUBLIC CUSTOMER DELIVERY SITE (RESPONSIVE: Mobile first, fluid tablet & desktop with max-w-4xl / max-w-5xl)
  return (
    <div className="min-h-screen bg-black text-white flex justify-center selection:bg-red-600 selection:text-white antialiased">
      <AudioNotificationBanner />
      <CartToastNotification />
      {/* Responsive Container: Full width on mobile, centered modern card on desktop */}
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl min-h-screen bg-black md:bg-neutral-950 md:border-x md:border-neutral-900 flex flex-col relative pb-24 md:pb-16 shadow-2xl">
        {/* Sticky Header */}
        <Header />

        {/* Customer Screens Router */}
        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
          {/* SCREEN 1: HOME */}
          {customerView === 'home' && (
            <div className="space-y-4">
              <Banner />

              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>Categorias</span>
                  </h3>
                  <span className="text-[11px] font-medium text-neutral-400">
                    Toque para abrir
                  </span>
                </div>
                {categories.length > 0 ? <CategorySquares /> : <div className="rounded-2xl border border-neutral-900 bg-neutral-950 px-4 py-8 text-center text-sm text-neutral-400">O cardápio da Burger House está sendo preparado.</div>}
              </div>
            </div>
          )}

          {/* SCREEN 2: CATEGORIAS VIEW */}
          {customerView === 'categories' && (
            <div className="space-y-3">
              <div className="py-2 px-1">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Categorias
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Escolha uma categoria para fazer seu pedido
                </p>
              </div>
              <CategorySquares />
            </div>
          )}

          {/* SCREEN 3: CATEGORY PRODUCTS LIST */}
          {customerView === 'products' && (
            <ProductList onBack={() => setCustomerView('home')} />
          )}

          {/* SCREEN 4: CART */}
          {customerView === 'cart' && <CartView />}

          {/* SCREEN 5: CHECKOUT */}
          {customerView === 'checkout' && <CheckoutView />}

          {/* SCREEN 6: ORDER STATUS TIMELINE */}
          {customerView === 'order-status' && (
            <OrderStatusView />
          )}

          {/* SCREEN 7: ORDER DELIVERED CELEBRATION */}
          {customerView === 'order-delivered' && <DeliveredView />}

          {/* MY ORDERS LIST */}
          {customerView === 'my-orders' && <CustomerOrdersView />}

          {/* PUBLIC FOOTER */}
          <Footer />
        </main>

        {/* Product Modal (Detail & Customization) */}
        <ProductModal />

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  );
};

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname + window.location.hash + window.location.search;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname + window.location.hash + window.location.search);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const isMaster =
    window.location.pathname.startsWith('/master') ||
    window.location.hash.startsWith('#/master') ||
    window.location.hash.includes('master') ||
    window.location.search.includes('mode=master');

  // O painel Master é um produto central separado. Este delivery não mantém
  // credenciais locais nem simula permissões da plataforma.
  if (isMaster) {
    return (
      <main className="min-h-screen bg-black text-white grid place-items-center p-6 text-center">
        <section className="max-w-md space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-7 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">NovaesWeb</p>
          <h1 className="text-2xl font-extrabold">Painel Master Central</h1>
          <p className="text-sm leading-6 text-neutral-400">
            O acesso Master é feito pela Central NovaesWeb. Este endereço é somente o delivery da loja.
          </p>
        </section>
      </main>
    );
  }

  const isAdmDono =
    window.location.pathname.startsWith('/admdono') ||
    window.location.hash.startsWith('#/admdono') ||
    window.location.hash.includes('admdono') ||
    window.location.search.includes('mode=admdono');

  // RESTAURANT APPLICATION (Customer / /admdono)
  return (
    <ErrorBoundary>
      <StoreProvider>
        <DeliveryAppContent
          isAdmDonoRoute={isAdmDono}
        />
      </StoreProvider>
    </ErrorBoundary>
  );
}


