import { Check, FileText, Store, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, InlineMessage, PageState, Toast } from '../components/ui.jsx';
import { useApi, useQuery } from '../hooks/useApi.js';
import { dateTime, money } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function CashPage() {
  const { session } = useAuth();
  return session.user.rol === 'ADMINISTRADOR' ? <AdminClosures /> : <CashierCash />;
}

function AdminClosures() {
  const closures = useQuery('/caja/cierres');
  return <div className="page-stack"><section className="section-heading"><div><span className="eyebrow">CAJA · SUPERVISIÓN</span><h2>Historial de cierres</h2><p>Turnos cerrados, montos y diferencias registradas.</p></div></section><section className="panel"><PageState loading={closures.loading} error={closures.error} empty={!closures.data?.length} emptyTitle="A?n no hay cierres" emptyMessage="El historial se llena cuando un cajero cierra un turno." onRetry={closures.reload}><div className="table-scroll"><table><thead><tr><th>Caja</th><th>Cajero</th><th>Apertura</th><th>Cierre</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>{closures.data?.map((row) => <tr key={row.id}><td>{row.cashRegister}</td><td>{row.cashier}</td><td>{dateTime(row.openedAt)}</td><td>{dateTime(row.closedAt)}</td><td>{money(row.expectedAmount)}</td><td>{money(row.countedAmount)}</td><td><Badge tone={Number(row.difference) === 0 ? 'success' : 'danger'}>{money(row.difference)}</Badge></td></tr>)}</tbody></table></div></PageState></section></div>;
}

function CashierCash() {
  const api = useApi();
  const state = useQuery('/caja/estado');
  const [initial, setInitial] = useState('200');
  const [counted, setCounted] = useState('');
  const [observation, setObservation] = useState('');
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const act = async (action) => {
    setBusy(true);
    try {
      if (action === 'open') {
        await api('/caja/apertura', { method: 'POST', body: { cashRegisterId: 1, initialAmount: Number(initial) } });
        setToast('Caja abierta correctamente.'); await state.reload();
      } else {
        const result = await api('/caja/cierre', { method: 'POST', body: { cashRegisterId: state.data.cashRegisterId, countedAmount: Number(counted), observation } });
        setSummary(result); setToast('Cierre registrado correctamente.'); await state.reload();
      }
    } catch (error) { setToast(error.message); }
    finally { setBusy(false); window.setTimeout(() => setToast(''), 3000); }
  };
  return <PageState loading={state.loading} error={state.error} onRetry={state.reload}><div className="page-stack">
    <section className="section-heading"><div><span className="eyebrow">CAJA · TURNO</span><h2>{state.data ? 'Turno abierto' : 'Apertura de caja'}</h2><p>{state.data ? `Caja ${state.data.code} abierta ${dateTime(state.data.openedAt)}` : 'Registra el fondo inicial antes de procesar ventas.'}</p></div>{state.data && <Badge><i className="status-dot" />Abierta</Badge>}</section>
    {!state.data ? <section className="panel opening-card"><span className="big-icon"><Store /></span><h3>Abrir Caja 01</h3><p>Una caja no puede tener dos turnos abiertos simultáneamente.</p><label>Monto inicial<div className="money-input"><span>S/</span><input type="number" min="0" value={initial} onChange={(event) => setInitial(event.target.value)} /></div></label><Button className="btn-full" disabled={busy || Number(initial) < 0} onClick={() => act('open')}><Check />Abrir caja e iniciar turno</Button></section>
      : <div className="cash-grid"><section className="panel cash-count"><div className="panel-heading"><div><h3>Conteo de efectivo</h3><p>El backend calculará el esperado y la diferencia</p></div><WalletCards /></div><div className="cash-form"><label>Efectivo contado<div className="money-input"><span>S/</span><input type="number" min="0" value={counted} onChange={(event) => setCounted(event.target.value)} placeholder="0.00" /></div></label><label>Observación<textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Obligatoria cuando existe diferencia" /></label><InlineMessage type="info">Monto inicial registrado: {money(state.data.initialAmount)}. Los cobros se totalizan desde los pagos aprobados.</InlineMessage><Button disabled={busy || counted === ''} onClick={() => act('close')}><FileText />Registrar cierre</Button></div></section>
        <section className="panel cash-note"><h3>Reglas del cierre</h3><ul><li>El efectivo esperado suma fondo inicial y pagos en efectivo.</li><li>Tarjeta y billeteras se muestran por separado.</li><li>Una diferencia exige observación.</li><li>El cierre queda asociado al cajero y a la caja.</li></ul></section></div>}
    {summary && <section className="panel summary-panel"><h3>Resumen del último cierre</h3><div className="summary-grid"><span>Esperado<strong>{money(summary.expectedCash)}</strong></span><span>Contado<strong>{money(summary.countedCash)}</strong></span><span>Diferencia<strong>{money(summary.difference)}</strong></span><span>Estado<strong>{summary.status}</strong></span></div></section>}
    <Toast message={toast} />
  </div></PageState>;
}
