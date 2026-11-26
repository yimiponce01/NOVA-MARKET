import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell, Box, ChevronDown, ClipboardList, LayoutDashboard, LogOut, Menu, ReceiptText,
  Settings, ShoppingCart, Truck, Users, WalletCards, X,
} from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge } from '../components/ui.jsx';

const groups = [
  { label: 'CAJA', roles: ['CAJERO', 'ADMINISTRADOR'], items: [
    ['/pos', 'Punto de venta', ShoppingCart, ['CAJERO']],
    ['/caja', 'Apertura / cierre', WalletCards, ['CAJERO', 'ADMINISTRADOR']],
    ['/comprobantes', 'Comprobantes', ReceiptText, ['CAJERO', 'ADMINISTRADOR']],
  ] },
  { label: 'ALMACÉN', roles: ['ADMINISTRADOR', 'LOGISTICA_ALMACEN', 'ENCARGADO_INVENTARIO', 'ASISTENTE_ADMINISTRATIVO'], items: [
    ['/inventario', 'Stock disponible', Box, ['ADMINISTRADOR', 'ENCARGADO_INVENTARIO', 'LOGISTICA_ALMACEN', 'ASISTENTE_ADMINISTRATIVO']],
    ['/alertas', 'Alertas de stock', Bell, ['ADMINISTRADOR', 'ENCARGADO_INVENTARIO', 'LOGISTICA_ALMACEN']],
    ['/ordenes', 'Órdenes y recepción', Truck, ['ADMINISTRADOR', 'LOGISTICA_ALMACEN']],
  ] },
  { label: 'ADMINISTRACIÓN', roles: ['ADMINISTRADOR'], items: [
    ['/dashboard', 'Dashboard y reportes', LayoutDashboard, ['ADMINISTRADOR']],
    ['/admin/usuarios', 'Usuarios y roles', Users, ['ADMINISTRADOR']],
    ['/admin/configuracion', 'Configuración', Settings, ['ADMINISTRADOR']],
    ['/admin/auditoria', 'Auditoría', ClipboardList, ['ADMINISTRADOR']],
  ] },
];

const titles = {
  '/dashboard': 'Dashboard', '/pos': 'Punto de venta', '/caja': 'Apertura y cierre de caja',
  '/comprobantes': 'Comprobantes', '/inventario': 'Stock disponible', '/alertas': 'Alertas de stock',
  '/ordenes': 'Órdenes y recepción', '/admin/usuarios': 'Usuarios y roles',
  '/admin/reportes': 'Reportes', '/admin/configuracion': 'Configuración', '/admin/auditoria': 'Auditoría',
};

export default function AppShell() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const user = session.user;
  const initials = `${user.nombre?.[0] || ''}${user.apellido?.[0] || ''}`;
  return <div className="app-shell">
    {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-logo"><Logo /><button className="sidebar-close" onClick={() => setOpen(false)}><X /></button></div>
      <nav>{groups.map((group) => {
        const items = group.items.filter((item) => item[3].includes(user.rol));
        if (!items.length) return null;
        return <div className="nav-group" key={group.label}><p>{group.label}</p>{items.map(([path, label, Icon]) =>
          <NavLink key={path} to={path} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Icon /><span>{label}</span></NavLink>)}</div>;
      })}</nav>
      <div className="sidebar-user"><div className="avatar">{initials}</div><div><strong>{user.nombre} {user.apellido}</strong><small>{user.rol.replaceAll('_', ' ')}</small></div><button onClick={logout} aria-label="Cerrar sesión"><LogOut /></button></div>
    </aside>
    <main className="app-main">
      <header className="topbar">
        <div className="topbar-title"><button className="mobile-menu" onClick={() => setOpen(true)}><Menu /></button><div><span>OPERACIONES</span><h1>{titles[location.pathname] || 'NOVA MARKET'}</h1></div></div>
        <div className="topbar-meta"><Badge tone="success"><i className="status-dot" />API conectada</Badge><div className="top-user"><div className="avatar">{initials}</div><span><strong>{user.nombre} {user.apellido}</strong><small>{user.rol.replaceAll('_', ' ')}</small></span><ChevronDown /></div></div>
      </header>
      <div className="page-content"><Outlet /></div>
    </main>
  </div>;
}
