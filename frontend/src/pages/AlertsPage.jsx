import { AlertTriangle, Check, Clock3, Truck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, PageState, Toast } from '../components/ui.jsx';
import { useApi, useQuery } from '../hooks/useApi.js';
import { dateTime } from '../utils/format.js';

export default function AlertsPage() {
  const [type, setType] = useState('');
  const alerts = useQuery(`/inventario/alertas${type ? `?type=${type}` : ''}`, [type]);
  const lots = useQuery('/inventario/lotes?proximosAVencer=true');
  const api = useApi();
  const navigate = useNavigate();
  const [toast, setToast] = useState('');
  const attend = async (id) => {
    try { await api(`/inventario/alertas/${id}/atender`, { method: 'PATCH' }); await alerts.reload(); setToast('Alerta atendida.'); }
    catch (error) { setToast(error.message); }
    window.setTimeout(() => setToast(''), 3000);
  };
  return <div className="page-stack"><section className="section-heading"><div><span className="eyebrow">ALMACÉN · ALERTAS</span><h2>Alertas de stock y vencimiento</h2><p>Alertas generadas por inventario y lotes registrados.</p></div><Button onClick={() => navigate('/ordenes')}><Truck />Ir a abastecimiento</Button></section>
    <div className="tabs">{[['', 'Todas'], ['STOCK_MINIMO', 'Stock bajo'], ['AGOTADO', 'Agotado']].map(([value, label]) => <button className={type === value ? 'active' : ''} onClick={() => setType(value)} key={label}>{label}</button>)}</div>
    <PageState loading={alerts.loading} error={alerts.error} empty={!alerts.data?.length} emptyTitle="No hay alertas pendientes" emptyMessage="Las alertas se generan cuando el stock llega al m?nimo o se agota." onRetry={alerts.reload}><div className="alert-list">{alerts.data?.map((alert) => <article className="alert-card" key={alert.id}><span className={`alert-symbol ${alert.type === 'AGOTADO' ? 'danger' : 'warning'}`}><AlertTriangle /></span><div className="alert-copy"><div><h3>{alert.product}</h3><Badge tone={alert.type === 'AGOTADO' ? 'danger' : 'warning'}>{alert.type.replace('_', ' ')}</Badge></div><p>{alert.code}</p><span>Stock {alert.stock} · mínimo {alert.minimumStock} · {dateTime(alert.date)}</span></div><div className="alert-actions"><Button variant="secondary" onClick={() => navigate('/inventario')}>Ver inventario</Button><Button onClick={() => attend(alert.id)}><Check />Atender</Button></div></article>)}</div></PageState>
    {lots.data?.length > 0 && <section className="panel"><div className="panel-heading"><div><h3>Próximos a vencer</h3><p>Según DIAS_ALERTA_VENCIMIENTO</p></div><Clock3 /></div><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Vencimiento</th></tr></thead><tbody>{lots.data.map((lot) => <tr key={lot.id}><td>{lot.product}</td><td className="mono">{lot.number}</td><td>{lot.quantity}</td><td>{new Date(lot.expirationDate).toLocaleDateString('es-PE')}</td></tr>)}</tbody></table></div></section>}
    <Toast message={toast} />
  </div>;
}
