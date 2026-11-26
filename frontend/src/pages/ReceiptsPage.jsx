import { FileText, Search, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, InlineMessage, Modal, PageState } from '../components/ui.jsx';
import { useApi, useQuery } from '../hooks/useApi.js';
import { dateTime, money } from '../utils/format.js';

export default function ReceiptsPage() {
  const [q, setQ] = useState('');
  const list = useQuery(`/comprobantes?q=${encodeURIComponent(q)}`, [q]);
  const api = useApi();
  const [detail, setDetail] = useState(null);
  const open = async (id) => setDetail(await api(`/comprobantes/${id}`));
  return <div className="page-stack"><section className="section-heading"><div><span className="eyebrow">CAJA · COMPROBANTES</span><h2>Comprobantes de venta</h2><p>Documentos generados localmente desde ventas pagadas.</p></div></section>
    <section className="panel"><div className="filter-row"><div className="input-icon grow"><Search /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar serie, número o cliente" /></div></div>
      <PageState loading={list.loading} error={list.error} empty={!list.data?.length} emptyTitle="A?n no hay comprobantes" emptyMessage="Aparecer?n despu?s de confirmar una venta pagada; su estado externo depende de una integraci?n configurada." onRetry={list.reload}><div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Serie y número</th><th>Cliente</th><th>Emisión</th><th>Total</th><th>Estado</th><th /></tr></thead><tbody>{list.data?.map((row) => <tr key={row.id}><td>{row.type}</td><td className="mono"><strong>{row.series}-{row.number}</strong></td><td>{row.client}</td><td>{dateTime(row.issuedAt)}</td><td><strong>{money(row.total)}</strong></td><td><Badge tone="info">{row.status}</Badge></td><td><Button variant="small" onClick={() => open(row.id)}>Ver detalle</Button></td></tr>)}</tbody></table></div></PageState>
    </section>
    {detail && <Modal title={`${detail.tipo} ${detail.serie}-${detail.numero}`} subtitle="Representación del comprobante generado localmente" onClose={() => setDetail(null)} wide><div className="receipt-grid"><section><InlineMessage type="info"><ShieldAlert />SUNAT no está configurada. El estado externo no se ha simulado.</InlineMessage><dl className="detail-list"><div><dt>Cliente</dt><dd>{detail.cliente || 'Cliente general'}</dd></div><div><dt>Cajero</dt><dd>{detail.cajero}</dd></div><div><dt>Caja</dt><dd>{detail.caja}</dd></div><div><dt>Fecha</dt><dd>{dateTime(detail.fecha_emision)}</dd></div></dl></section><article className="receipt-paper"><h3>NOVA MARKET</h3><strong>{detail.tipo} {detail.serie}-{detail.numero}</strong><hr />{detail.items.map((item, index) => <p key={index}>{item.quantity} × {item.nombre}<span>{money(item.subtotal)}</span></p>)}<hr /><h3>TOTAL <span>{money(detail.total)}</span></h3><small>Representación local; no acredita envío a SUNAT</small></article></div></Modal>}
  </div>;
}
