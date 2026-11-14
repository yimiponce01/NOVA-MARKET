import { useAuth } from '../context/AuthContext.jsx';

const roleLabels = { ADMIN: 'Administrador', CASHIER: 'Cajero', WAREHOUSE: 'Logística de almacén' };
export default function DashboardLayout() {
  const { session, saveSession } = useAuth();
  const user = session.user;
  const links = user.role === 'ADMIN'
    ? ['Dashboard', 'Catálogo', 'Usuarios', 'Ventas', 'Inventario', 'Reportes']
    : user.role === 'CASHIER'
      ? ['Dashboard', 'Catálogo', 'Registrar venta', 'Mis ventas']
      : ['Dashboard', 'Consultar stock', 'Recepción de mercadería', 'Mermas'];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-mark">N</div><h2>NOVA</h2><small>MARKET · POS</small>
      <nav>{links.map(link => <div className={link === 'Dashboard' ? 'nav-item active' : 'nav-item'} key={link}>{link}</div>)}</nav>
      <button className="logout" onClick={() => saveSession(null)}>Cerrar sesión</button>
    </aside>
    <main className="main-area">
      <header className="topbar"><span>Panel de control</span><div><b>{user.name}</b><small>{roleLabels[user.role]}</small></div></header>
      <section className="content">
        <div className="welcome"><div><p className="eyebrow">NOVA MARKET / DEMO</p><h1>Bienvenido, {user.name.split(' ')[0]}</h1><p>Prototipo académico de gestión de minimarket.</p></div><span className="demo-badge">Modo demostración</span></div>
        <div className="stats">
          <article className="stat-card"><span>Productos demo</span><strong>24</strong><small>Catálogo de prueba</small></article>
          <article className="stat-card"><span>Ventas del día</span><strong>18</strong><small>Datos ilustrativos</small></article>
          <article className="stat-card"><span>Alertas de stock</span><strong>3</strong><small>Requieren revisión</small></article>
        </div>
        <article className="module-card"><h2>Accesos del rol</h2><p>Estas opciones se muestran como ejemplo de navegación por rol. Los módulos de negocio se implementarán en las siguientes etapas.</p><div className="module-grid">{links.map((link, i) => <div className="module-tile" key={link}><span>{String(i + 1).padStart(2, '0')}</span><b>{link}</b><small>Preparado para implementar</small></div>)}</div></article>
        <p className="footer-note">NOVA MARKET · Starter funcional de autenticación · No usar en producción</p>
      </section>
    </main>
  </div>;
}
