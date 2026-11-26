import { AlertTriangle, Check, Minus, Plus, Search, ShoppingCart, Trash2, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, InlineMessage, Modal, PageState, Toast } from '../components/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { money } from '../utils/format.js';

export default function PosPage() {
  const api = useApi();
  const [cash, setCash] = useState({ loading: true, data: null, error: '' });
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [sale, setSale] = useState(null);
  const [payment, setPayment] = useState(false);
  const [received, setReceived] = useState('');
  const [receiptType, setReceiptType] = useState('BOLETA');
  const [client, setClient] = useState({ name: '', dni: '', ruc: '' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast({ message: '', type }), 3000);
  };

  const load = async () => {
    setCash({ loading: true, data: null, error: '' });
    try {
      const [cashState, catalog] = await Promise.all([api('/caja/estado'), api('/productos')]);
      setCash({ loading: false, data: cashState, error: '' });
      setProducts(catalog);
    } catch (error) { setCash({ loading: false, data: null, error: error.message }); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => products.filter((product) =>
    product.name.toLowerCase().includes(query.toLowerCase()) || product.code.includes(query)).slice(0, 6), [products, query]);
  const hasClient = Boolean(client.name.trim() || client.dni.trim() || client.ruc.trim());
  const validDocument = receiptType === 'FACTURA'
    ? Boolean(client.name.trim().length >= 2 && /^\d{11}$/.test(client.ruc))
    : (!hasClient || client.name.trim().length >= 2) && (!client.dni || /^\d{8}$/.test(client.dni));

  const ensureSale = async () => {
    if (sale) return sale;
    if (!cash.data) throw new Error('Debes abrir la caja antes de iniciar una venta.');
    const created = await api('/ventas', { method: 'POST', body: { cashRegisterId: cash.data.cashRegisterId } });
    setSale(created);
    return created;
  };

  const setItem = async (product, quantity) => {
    if (quantity < 1) return;
    setBusy(true);
    try {
      const current = await ensureSale();
      const updated = await api(`/ventas/${current.id}/items`, { method: 'POST', body: { productId: product.id, quantity } });
      setSale(updated); setQuery(''); notify(`${product.name} actualizado.`);
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(false); }
  };

  const remove = async (item) => {
    try {
      const updated = await api(`/ventas/${sale.id}/items/${item.id}`, { method: 'DELETE' });
      setSale(updated);
    } catch (error) { notify(error.message, 'error'); }
  };

  const cancel = async () => {
    if (!sale) return;
    try { await api(`/ventas/${sale.id}/anular`, { method: 'POST' }); setSale(null); notify('Venta anulada sin afectar inventario.'); }
    catch (error) { notify(error.message, 'error'); }
  };

  const payAndConfirm = async () => {
    if (!validDocument) return;
    setBusy(true);
    try {
      const amount = sale.pending;
      await api(`/ventas/${sale.id}/pagos`, { method: 'POST', body: { method: 'EFECTIVO', amount, receivedAmount: Number(received) } });
      await api(`/ventas/${sale.id}/confirmar`, { method: 'POST' });
      const clientData = hasClient
        ? { name: client.name.trim(), ...(receiptType === 'FACTURA' ? { ruc: client.ruc } : client.dni ? { dni: client.dni } : {}) }
        : null;
      const receipt = await api('/comprobantes', { method: 'POST', body: { saleId: sale.id, type: receiptType, client: clientData } });
      setPayment(false); setSale(null); setReceived(''); setReceiptType('BOLETA'); setClient({ name: '', dni: '', ruc: '' });
      notify(`Venta confirmada. ${receiptType === 'FACTURA' ? 'Factura' : 'Boleta'} ${receipt.serie}-${receipt.numero} generada localmente.`);
      const catalog = await api('/productos'); setProducts(catalog);
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(false); }
  };

  return <PageState loading={cash.loading} error={cash.error} onRetry={load}><div className="pos-layout">
    <section className="pos-main">
      {!cash.data && <InlineMessage type="error">La caja está cerrada. Abre un turno desde “Apertura / cierre” antes de vender.</InlineMessage>}
      <section className="panel product-search"><label>Buscar por código o nombre<div className="input-icon"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escanea o escribe un producto" /></div></label>
        {query && <div className="search-results">{filtered.length ? filtered.map((product) => <button key={product.id} disabled={product.status === 'AGOTADO' || busy} onClick={() => setItem(product, 1)}><span><strong>{product.name}</strong><small>{product.code} · Stock {product.stock}</small></span><b>{money(product.price)}</b></button>) : <p>El producto no se encuentra registrado.</p>}</div>}
      </section>
      <section className="panel cart-panel"><div className="panel-heading"><div><h3>Venta en curso</h3><p>{sale ? `Venta N.º ${sale.id}` : 'Agrega el primer producto para iniciar'}</p></div>{sale && <Button variant="danger-ghost" onClick={cancel}><Trash2 />Cancelar venta</Button>}</div>
        <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Código</th><th>Cantidad</th><th>P. unit.</th><th>Subtotal</th><th /></tr></thead><tbody>{sale?.items?.map((item) => {
          const product = products.find((entry) => entry.id === item.productId) || item;
          return <tr key={item.id}><td><strong>{item.nombre}</strong><small>{product.category}</small></td><td className="mono">{item.code}</td><td><div className="stepper"><button disabled={busy} onClick={() => setItem(product, item.quantity - 1)}><Minus /></button><span>{item.quantity}</span><button disabled={busy} onClick={() => setItem(product, item.quantity + 1)}><Plus /></button></div></td><td>{money(item.price)}</td><td><strong>{money(item.subtotal)}</strong></td><td><button className="icon-btn danger" onClick={() => remove(item)}><Trash2 /></button></td></tr>;
        })}</tbody></table></div>
        {!sale?.items?.length && <div className="empty-state"><ShoppingCart /><h3>La venta está vacía</h3><p>Busca un producto para comenzar.</p></div>}
      </section>
    </section>
    <aside className="pos-summary"><section className="panel total-card"><div className="panel-heading"><div><h3>Resumen de venta</h3><p>IGV configurado: 18%</p></div>{sale && <Badge tone="info">V-{sale.id}</Badge>}</div><dl><div><dt>Ítems</dt><dd>{sale?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}</dd></div><div><dt>Op. gravada</dt><dd>{money(sale?.taxable)}</dd></div><div><dt>IGV</dt><dd>{money(sale?.tax)}</dd></div></dl><div className="grand-total"><span>Total a cobrar</span><strong>{money(sale?.total)}</strong></div><Button className="btn-full btn-large" disabled={!sale?.items?.length || !cash.data} onClick={() => { setReceived(String(sale.total.toFixed(2))); setPayment(true); }}><WalletCards />Cobrar ahora</Button>
      <InlineMessage type="info">Tarjeta, Yape y Plin permanecen deshabilitados hasta configurar una integración financiera real.</InlineMessage></section></aside>
    {payment && <Modal title="Procesar pago" subtitle={`Venta N.º ${sale.id}`} onClose={() => setPayment(false)}>
      <div className="payment-total"><span>Total a cobrar</span><strong>{money(sale.total)}</strong></div>
      <div className="method-grid"><button className="selected"><span>EFECTIVO</span><Check /></button><button disabled>TARJETA</button><button disabled>YAPE</button><button disabled>PLIN</button></div>
      <label>Tipo de comprobante<select value={receiptType} onChange={(event) => setReceiptType(event.target.value)}><option value="BOLETA">Boleta</option><option value="FACTURA">Factura</option></select></label>
      <label>{receiptType === 'FACTURA' ? 'Razón social' : 'Nombre del cliente (opcional)'}<input value={client.name} onChange={(event) => setClient({ ...client, name: event.target.value })} maxLength={100} /></label>
      {receiptType === 'FACTURA'
        ? <label>RUC (11 dígitos)<input inputMode="numeric" value={client.ruc} onChange={(event) => setClient({ ...client, ruc: event.target.value.replace(/\D/g, '').slice(0, 11) })} /></label>
        : <label>DNI (opcional, 8 dígitos)<input inputMode="numeric" value={client.dni} onChange={(event) => setClient({ ...client, dni: event.target.value.replace(/\D/g, '').slice(0, 8) })} /></label>}
      {receiptType === 'FACTURA' && !validDocument && <InlineMessage type="error">La factura requiere razón social y RUC de 11 dígitos.</InlineMessage>}
      {receiptType === 'BOLETA' && client.dni && client.dni.length !== 8 && <InlineMessage type="error">El DNI debe tener 8 dígitos.</InlineMessage>}
      <label>Monto recibido<div className="money-input"><span>S/</span><input type="number" min={sale.total} step=".1" value={received} onChange={(event) => setReceived(event.target.value)} /></div></label>
      {Number(received) < sale.total && <InlineMessage type="error">Falta {money(sale.total - Number(received || 0))} para cubrir la venta.</InlineMessage>}
      <div className="payment-result"><span>Vuelto a entregar</span><strong>{money(Math.max(0, Number(received || 0) - sale.total))}</strong></div>
      <div className="modal-actions"><Button variant="secondary" onClick={() => setPayment(false)}>Cancelar</Button><Button disabled={busy || Number(received) < sale.total || !validDocument} onClick={payAndConfirm}>Confirmar y emitir {receiptType === 'FACTURA' ? 'factura' : 'boleta'}</Button></div>
    </Modal>}
    <Toast {...toast} />
  </div></PageState>;
}
