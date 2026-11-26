import { Archive, BarChart3, Plus, Search, Settings, ShieldCheck, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { Badge, Button, InlineMessage, Modal, PageState, Toast } from '../components/ui.jsx';
import { useApi, useQuery } from '../hooks/useApi.js';
import { dateTime, money } from '../utils/format.js';

const tabs = [
  ['/admin/usuarios', 'Usuarios y roles'],
  ['/admin/reportes', 'Reportes'],
  ['/admin/configuracion', 'Configuración'],
  ['/admin/auditoria', 'Auditoría'],
];

function Header({ title, description, action }) {
  return <><section className="section-heading"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2>{title}</h2><p>{description}</p></div>{action}</section><div className="tabs admin-tabs">{tabs.map(([path, label]) => <NavLink key={path} to={path} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}</div></>;
}

export default function AdminPage({ section }) {
  if (section === 'users') return <UsersSection />;
  if (section === 'reports') return <ReportsSection />;
  if (section === 'config') return <ConfigSection />;
  return <AuditSection />;
}

function UsersSection() {
  const users = useQuery('/usuarios');
  const roles = useQuery('/roles');
  const api = useApi();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ active: true });
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const create = async (event) => {
    event.preventDefault();
    try {
      await api('/usuarios', { method: 'POST', body: { ...form, roleId: Number(form.roleId) } });
      setModal(false); setForm({ active: true }); await users.reload(); setToast({ message: 'Usuario creado.', type: 'success' });
    } catch (error) { setToast({ message: error.message, type: 'error' }); }
    window.setTimeout(() => setToast({ message: '', type: 'success' }), 3000);
  };
  return <div className="page-stack"><Header title="Usuarios y roles" description="Cuentas asociadas a los cinco roles documentados." action={<Button onClick={() => setModal(true)}><Plus />Crear usuario</Button>} />
    <section className="panel"><PageState loading={users.loading} error={users.error} empty={!users.data?.length} emptyTitle="No hay usuarios registrados" emptyMessage="Los usuarios habilitados aparecer?n aqu? junto con su rol y estado." onRetry={users.reload}><div className="table-scroll"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{users.data?.map((user) => <tr key={user.id}><td className="mono"><strong>{user.username}</strong></td><td>{user.name} {user.surname}</td><td>{user.email || '—'}</td><td><Badge tone="info">{user.role.replaceAll('_', ' ')}</Badge></td><td><Badge tone={user.status === 'ACTIVO' ? 'success' : 'neutral'}>{user.status}</Badge></td></tr>)}</tbody></table></div></PageState></section>
    {modal && <Modal title="Crear usuario" subtitle="La autorización dependerá exclusivamente del rol" onClose={() => setModal(false)}><form className="form-stack" onSubmit={create}><div className="form-grid two"><label>Nombres<input required value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Apellidos<input required value={form.surname || ''} onChange={(event) => setForm({ ...form, surname: event.target.value })} /></label><label>Usuario<input required value={form.username || ''} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><label>Correo<input type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Rol<select required value={form.roleId || ''} onChange={(event) => setForm({ ...form, roleId: event.target.value })}><option value="">Selecciona</option>{roles.data?.map((role) => <option value={role.id} key={role.id}>{role.name.replaceAll('_', ' ')}</option>)}</select></label><label>Contraseña inicial<input required type="password" minLength="8" value={form.password || ''} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label></div><InlineMessage type="info"><ShieldCheck />La contraseña se almacena con bcrypt; no podrá consultarse luego.</InlineMessage><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button>Crear usuario</Button></div></form></Modal>}
    <Toast {...toast} />
  </div>;
}

function ReportsSection() {
  const api = useApi();
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState('');
  const generate = async (type) => {
    setLoading(type);
    try { setReports({ ...reports, [type]: await api(`/reportes/${type}`) }); }
    finally { setLoading(''); }
  };
  const definitions = [
    ['ventas', 'Reporte de ventas', 'Transacciones, unidades y montos por fecha', BarChart3],
    ['productos', 'Reporte de productos', 'Unidades y monto por producto', Archive],
    ['inventario', 'Reporte de inventario', 'Stock, mínimos y valorización', Settings],
    ['caja', 'Reporte de caja', 'Turnos, esperados y diferencias', ShieldCheck],
  ];
  return <div className="page-stack"><Header title="Reportes" description="Resultados calculados desde datos persistidos." />
    <div className="reports-grid">{definitions.map(([type, name, description, Icon]) => <article className="panel report-card" key={type}><span><Icon /></span><h3>{name}</h3><p>{description}</p><Button className="btn-full" disabled={loading === type} onClick={() => generate(type)}>{loading === type ? 'Generando…' : 'Generar reporte'}</Button>{reports[type] && <Badge>{reports[type].rows.length} registros</Badge>}</article>)}</div>
    {Object.entries(reports).map(([type, report]) => <section className="panel" key={type}><div className="panel-heading"><div><h3>Resultado: {type}</h3><p>Generado {dateTime(report.generatedAt)}</p></div></div><div className="report-json">{report.rows.slice(0, 20).map((row, index) => <div key={index}>{Object.entries(row).map(([key, value]) => <span key={key}><small>{key}</small><strong>{typeof value === 'number' && /total|value|amount/i.test(key) ? money(value) : String(value ?? '—')}</strong></span>)}</div>)}</div></section>)}
  </div>;
}

function ConfigSection() {
  const config = useQuery('/configuracion');
  const api = useApi();
  const [form, setForm] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const value = (key) => form[key] ?? config.data?.[key]?.value ?? '';
  const save = async (event) => {
    event.preventDefault();
    try { await api('/configuracion', { method: 'PUT', body: form }); await config.reload(); setForm({}); setToast({ message: 'Configuración actualizada.', type: 'success' }); }
    catch (error) { setToast({ message: error.message, type: 'error' }); }
    window.setTimeout(() => setToast({ message: '', type: 'success' }), 3000);
  };
  return <div className="page-stack"><Header title="Configuración" description="Parámetros editables sin modificar código." /><PageState loading={config.loading} error={config.error} onRetry={config.reload}><form className="settings-grid" onSubmit={save}><section className="panel setting-card"><div className="panel-heading"><div><h3>Operación</h3><p>Impuestos y series</p></div><Settings /></div><div className="form-grid two"><label>IGV (%)<input value={value('IGV')} onChange={(event) => setForm({ ...form, IGV: event.target.value })} /></label><label>Días alerta vencimiento<input value={value('DIAS_ALERTA_VENCIMIENTO')} onChange={(event) => setForm({ ...form, DIAS_ALERTA_VENCIMIENTO: event.target.value })} /></label><label>Serie boleta<input value={value('SERIE_BOLETA')} onChange={(event) => setForm({ ...form, SERIE_BOLETA: event.target.value })} /></label><label>Serie factura<input value={value('SERIE_FACTURA')} onChange={(event) => setForm({ ...form, SERIE_FACTURA: event.target.value })} /></label></div></section><section className="panel setting-card"><div className="panel-heading"><div><h3>Información del negocio</h3><p>Datos pendientes de validar</p></div><Archive /></div><div className="form-grid"><label>Nombre comercial<input value={value('NOMBRE_NEGOCIO')} onChange={(event) => setForm({ ...form, NOMBRE_NEGOCIO: event.target.value })} placeholder="NOVA MARKET" /></label><label>RUC<input value={value('RUC_NEGOCIO')} onChange={(event) => setForm({ ...form, RUC_NEGOCIO: event.target.value })} placeholder="Pendiente de definir" /></label><label>Dirección<input value={value('DIRECCION_NEGOCIO')} onChange={(event) => setForm({ ...form, DIRECCION_NEGOCIO: event.target.value })} /></label></div></section><section className="panel backup-panel"><div><Archive /><span><h3>Respaldos</h3><p>Requieren BACKUP_DIR y pg_dump/pg_restore configurados.</p></span></div><Button type="button" variant="secondary" onClick={async () => { try { await api('/respaldos', { method: 'POST' }); setToast({ message: 'Respaldo generado.', type: 'success' }); } catch (error) { setToast({ message: error.message, type: 'error' }); } }}>Generar respaldo</Button></section><Button className="save-settings">Guardar cambios</Button></form></PageState><Toast {...toast} /></div>;
}

function AuditSection() {
  const audit = useQuery('/auditoria');
  return <div className="page-stack"><Header title="Auditoría" description="Trazabilidad de operaciones críticas." /><section className="panel"><div className="filter-row"><div className="input-icon grow"><Search /><input placeholder="Filtrado disponible mediante parámetros de API" /></div></div><PageState loading={audit.loading} error={audit.error} empty={!audit.data?.length} onRetry={audit.reload}><div className="timeline">{audit.data?.map((entry) => <div key={entry.id}><span className="timeline-dot"><ShieldCheck /></span><time>{dateTime(entry.date)}</time><p><strong>{entry.action}</strong><span>{entry.description}</span><small>{entry.username} · {entry.ip || 'IP no disponible'}</small></p></div>)}</div></PageState></section></div>;
}
