import { useConnect } from '../../context/ConnectContext';
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Package, ShoppingBag, FolderTree, Users, Wallet, ChartNoAxesCombined, Settings, Headphones, ArrowUpRight, Menu, X, Store, ChevronRight } from 'lucide-react';
import { useStore, type AdminView } from '../../context/StoreContext';
import { GlobalOrderNotifications } from './GlobalOrderNotifications';
const navigation = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'orders', label: 'Pedidos', icon: Package },
  { id: 'products', label: 'Produtos', icon: ShoppingBag },
  { id: 'categories', label: 'Categorias', icon: FolderTree },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'sales', label: 'Vendas', icon: Wallet },
  { id: 'reports', label: 'Relatórios', icon: ChartNoAxesCombined },
  { id: 'settings', label: 'Configurações', icon: Settings },
  { id: 'support', label: 'Suporte', icon: Headphones },
] as const;
export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { adminView, setAdminView, siteSettings, storeAdmin, updateSettingsAction, orders, setAppMode } = useStore();
  const connection = useConnect();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setAppMode('admin');
    return () => setAppMode('customer');
  }, [setAppMode]);
  const pending = orders.filter(order => order.status === 'recebido').length;
  const navigate = (view: AdminView) => { setAdminView(view); setMenuOpen(false); };
  return <div className="admin-shell">
    {menuOpen && <button className="admin-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
    <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <a href="/" className="admin-brand"><span className="brand-symbol"><Store size={22} /></span><span><strong>{siteSettings.name}</strong><small>GESTÃO DA LOJA</small></span></a>
      <div className="sidebar-section-label">PRINCIPAL</div>
      <nav aria-label="Menu administrativo">{navigation.map(({id,label,icon: Icon},index) => <React.Fragment key={id}>
        {index === 5 && <div className="sidebar-section-label">GERENCIAMENTO</div>}
        <button className={`admin-nav-item ${adminView === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span>{id === 'orders' && pending > 0 && <b>{pending}</b>}</button>
      </React.Fragment>)}</nav>
      <div className="sidebar-bottom"><a href="/" className="admin-store-link">Ver minha loja <ArrowUpRight size={17}/></a><div className="admin-profile"><span className="profile-avatar">{(storeAdmin.name || 'P').charAt(0)}</span><span><strong>{storeAdmin.name || 'Proprietário'}</strong><small>Proprietário</small></span></div></div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><div className="admin-breadcrumb"><button className="mobile-menu-button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22}/> : <Menu size={22}/>}</button><span>Painel da loja</span><ChevronRight size={14}/><strong>{navigation.find(item => item.id === adminView)?.label}</strong></div><button className={`store-status-toggle ${siteSettings.isOpen ? 'is-open' : ''}`} onClick={() => updateSettingsAction({isOpen: !siteSettings.isOpen})}><span/>{siteSettings.isOpen ? 'Loja aberta' : 'Loja fechada'}</button></header>
      <div className="preview-notice">Conectado ao NovaesWeb Master · Conta autenticada <button onClick={() => void connection.signOut()} style={{float:'right'}}>Sair</button></div>
      <GlobalOrderNotifications />
      <main className="admin-content">{children}</main>
    </div>
  </div>;
};

