import { useConnect } from '../../context/ConnectContext';
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Package, ShoppingBag, FolderTree, Users, Wallet, ChartNoAxesCombined, Settings, Headphones, ArrowUpRight, Menu, X, ChevronRight, Star, UtensilsCrossed, PanelLeftClose, PanelLeftOpen, Megaphone, UserCog, Puzzle, Bell } from 'lucide-react';
import { useStore, type AdminView } from '../../context/StoreContext';
import { GlobalOrderNotifications } from './GlobalOrderNotifications';
import burgerHouseLogo from '../../assets/brand/burger-house-logo.png';
import './orders.css';
const navigation = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'orders', label: 'Pedidos', icon: Package },
  { id: 'products', label: 'Produtos', icon: ShoppingBag },
  { id: 'categories', label: 'Categorias', icon: FolderTree },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'team', label: 'Equipe e acessos', icon: UserCog },
  { id: 'sales', label: 'Vendas', icon: Wallet },
  { id: 'reports', label: 'Relatórios', icon: ChartNoAxesCombined },
  { id: 'reviews', label: 'Avaliações', icon: Star },
  { id: 'addons', label: 'Adicionais', icon: Puzzle },
  { id: 'settings', label: 'Configurações', icon: Settings },
  { id: 'messages', label: 'Mensagens', icon: Bell },
  { id: 'support', label: 'Suporte', icon: Headphones },
  { id: 'extras', label: 'Ferramentas', icon: UtensilsCrossed },
] as const;
export const AdminLayout: React.FC<{ children: React.ReactNode; restricted?: boolean }> = ({ children, restricted = false }) => {
  const { adminView, setAdminView, siteSettings, storeAdmin, updateSettingsAction, orders, setAppMode } = useStore();
  const connection = useConnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('admin_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width:1023px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width:1023px)');
    const update = () => { setCompact(query.matches); setMenuOpen(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    setAppMode('admin');
    return () => setAppMode('customer');
  }, [setAppMode]);
  const pending = restricted ? 0 : orders.filter(order => order.status === 'recebido').length;
  const visibleNavigation = navigation.filter(item => (!restricted || ['settings','messages','support'].includes(item.id)) && (item.id !== 'addons' || connection.store?.role === 'owner' || connection.store?.role === 'admin'));
  const currentLabel = restricted && !['messages','support'].includes(adminView) ? 'Minha conta' : navigation.find(item => item.id === adminView)?.label;
  const sidebarHidden = compact ? !menuOpen : sidebarCollapsed;
  const toggleSidebar = () => {
    if (compact) { setMenuOpen(!menuOpen); return; }
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try { localStorage.setItem('admin_sidebar_collapsed', String(next)); } catch {}
  };
  const navigate = (view: AdminView) => { setAdminView(view); setMenuOpen(false); };
  return <div className={`admin-shell ${!compact && sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
    {menuOpen && <button className="admin-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
    <aside id="admin-sidebar" className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`} aria-hidden={sidebarHidden} inert={sidebarHidden ? true : undefined}>
      <a href="/" className="admin-brand"><span className="brand-symbol overflow-hidden"><img src={burgerHouseLogo} alt="" className="h-full w-full object-cover object-top scale-125" /></span><span><strong>{connection.store?.name || siteSettings.name}</strong><small>GESTÃO DA LOJA</small></span></a>
      <div className="sidebar-section-label">PRINCIPAL</div>
      <nav aria-label="Menu administrativo">{visibleNavigation.map(({id,label,icon: Icon},index) => <React.Fragment key={id}>
        {index === 5 && <div className="sidebar-section-label">GERENCIAMENTO</div>}
        <button className={`admin-nav-item ${(adminView === id || (restricted && id === 'settings' && !['messages','support'].includes(adminView))) ? 'active' : ''}`} onClick={() => navigate(id)}><Icon size={19} /><span>{restricted && id === 'settings' ? 'Minha conta' : label}</span>{id === 'orders' && pending > 0 && <b>{pending}</b>}</button>
      </React.Fragment>)}</nav>
      <div className="sidebar-bottom"><a href="/" className="admin-store-link">Ver minha loja <ArrowUpRight size={17}/></a><div className="admin-profile"><span className="profile-avatar">{(storeAdmin.name || 'P').charAt(0)}</span><span><strong>{storeAdmin.name || 'Proprietário'}</strong><small>Proprietário</small></span></div></div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><div className="admin-breadcrumb"><button className="sidebar-menu-button" aria-label={compact ? (menuOpen ? 'Fechar menu' : 'Abrir menu') : (sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral')} title={sidebarHidden ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!sidebarHidden} aria-controls="admin-sidebar" onClick={toggleSidebar}>{compact ? (menuOpen ? <X size={22}/> : <Menu size={22}/>) : (sidebarCollapsed ? <PanelLeftOpen size={21}/> : <PanelLeftClose size={21}/>)}</button><span>Painel da loja</span><ChevronRight size={14}/><strong>{currentLabel}</strong></div>{!restricted && <button className={`store-status-toggle ${siteSettings.isOpen ? 'is-open' : ''}`} onClick={() => updateSettingsAction({isOpen: !siteSettings.isOpen})}><span/>{siteSettings.isOpen ? 'Loja aberta' : 'Loja fechada'}</button>}</header>
      <div className="preview-notice">Conectado ao NovaesWeb Master · Conta autenticada <button onClick={() => void connection.signOut()} style={{float:'right'}}>Sair</button></div>
      {restricted ? <p role="status" className="mx-4 mt-4 rounded-xl border border-amber-500/30 p-4 text-sm text-amber-100">Acesso limitado à conta, mensagens e suporte. As operações da loja dependem da liberação do Master.</p> : <GlobalOrderNotifications />}
      <main className={`admin-content ${adminView==='orders'||adminView==='reviews'?'is-wide':''}`}>{children}</main>
    </div>
  </div>;
};

