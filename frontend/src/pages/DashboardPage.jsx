import { BarChart3, Bell, Box, CircleDollarSign, ReceiptText, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, PageState } from '../components/ui.jsx';
import { useQuery } from '../hooks/useApi.js';
import { money, dateTime } from '../utils/format.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useQuery('/dashboard/resumen');
  return <PageState loading={loading} error={error} onRetry={reload}><div className="page-stack">
    <section className="section-heading"><div><span className="eyebrow">RESUMEN DE HOY</span><h2>Panel de operaciones</h2><p>Información calculada desde la base de datos.</p></div><Button onClick={() => navigate('/admin/reportes')}><BarChart3 />Ver reportes</Button></section>
    <div className="kpi-grid">{[
      ['Ventas del día', money(data?.salesToday), `${data?.transactions || 0} transacciones`, CircleDollarSign, 'green'],
      ['Transacciones', data?.transactions || 0, 'Ventas confirmadas hoy', ReceiptText, 'blue'],
      ['Cajas abiertas', data?.openCashRegisters || 0, 'Turnos actualmente activos', Store, 'green'],
      ['Alertas activas', data?.activeAlerts || 0, 'Pendientes de atención', Bell, 'amber'],
    ].map(([label, value, detail, Icon, tone]) => <article className="kpi" key={label}><span className={`kpi-icon ${tone}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>)}</div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h3>Ventas por hora</h3><p>Totales confirmados durante la jornada</p></div><Badge tone="info">Hoy</Badge></div>
        <div className="chart-bars">{Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => {
          const value = data?.salesByHour?.find((row) => row.hour === hour)?.total || 0;
          const max = Math.max(1, ...(data?.salesByHour || []).map((row) => row.total));
          return <div className="bar-wrap" key={hour}><div className="bar" style={{ height: `${Math.max(4, value / max * 100)}%` }} title={money(value)} /><span>{hour}h</span></div>;
        })}</div>
      </section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h3>Actividad reciente</h3><p>Eventos auditados</p></div><Box /></div>
        <div className="activity-list">{data?.recentActivity?.length ? data.recentActivity.map((event, index) => <div key={`${event.date}-${index}`}><span className="activity-dot" /><p><strong>{event.action}</strong><small>{event.description}</small></p><time>{dateTime(event.date)}</time></div>) : <p className="empty-inline">Aún no hay actividad auditada.</p>}</div>
      </section>
    </div>
  </div></PageState>;
}
