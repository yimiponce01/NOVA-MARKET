import { Check, Plus, Search, Truck } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Modal, PageState, Toast } from '../components/ui.jsx';
import { useApi, useQuery } from '../hooks/useApi.js';
import { money } from '../utils/format.js';

export default function OrdersPage() {
  const orders = useQuery('/ordenes-compra');
  const suppliers = useQuery('/proveedores');
  const products = useQuery('/productos');
  const api = useApi();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ items: [{ productId: '', quantity: 1, price: '' }] });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const notify = (message, type = 'success') => { setToast({ message, type }); window.setTimeout(() => setToast({ message: '', type }), 3000); };
  const changeItem = (index, field, value) => setForm({ ...form, items: form.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) });
  const create = async (event) => {
    event.preventDefault();
    try {
      await api('/ordenes-compra', { method: 'POST', body: {
        supplierId: Number(form.supplierId), observation: form.observation || undefined,
        items: form.items.map((item) => ({ productId: Number(item.productId), quantity: Number(item.quantity), price: Number(item.price) })),
      } });
      setModal(null); await orders.reload(); notify('Orden creada como pendiente.');
    } catch (error) { notify(error.message, 'error'); }
  };
  const changeStatus = async (order, status) => {
    try { await api(`/ordenes-compra/${order.id}/estado`, { method: 'PATCH', body: { status } }); await orders.reload(); notify(`Orden actualizada a ${status}.`); }
    catch (error) { notify(error.message, 'error'); }
  };
  const openReception = async (order) => {
    try { const detail = await api(`/ordenes-compra/${order.id}`); setSelected(detail); setForm({ items: detail.details.filter((item) => item.receivedQuantity < item.quantity).map((item) => ({ detailId: item.id, quantity: item.quantity - item.receivedQuantity })) }); setModal('reception'); }
    catch (error) { notify(error.message, 'error'); }
  };
  const receive = async (event) => {
    event.preventDefault();
    try { await api(`/ordenes-compra/${selected.id}/recepcion`, { method: 'POST', body: form }); setModal(null); await orders.reload(); notify('Mercadería recepcionada e inventario actualizado.'); }
    catch (error) { notify(error.message, 'error'); }
  };
  const tone = (status) => status === 'RECIBIDA' ? 'success' : status === 'ENVIADA' ? 'info' : status === 'ANULADA' ? 'danger' : 'warning';
  return <div className="page-stack"><section className="section-heading"><div><span className="eyebrow">ALMACÉN · ABASTECIMIENTO</span><h2>Órdenes y recepción</h2><p>Relación Proveedor → Orden → Detalles → Productos.</p></div><Button onClick={() => { setForm({ items: [{ productId: '', quantity: 1, price: '' }] }); setModal('order'); }}><Plus />Crear orden</Button></section>
    <section className="panel"><div className="filter-row"><div className="input-icon grow"><Search /><input placeholder="Buscar orden o proveedor" /></div></div><PageState loading={orders.loading} error={orders.error} empty={!orders.data?.length} emptyTitle="A?n no hay ?rdenes" emptyMessage="Crea una orden para registrar productos solicitados y seguir su recepci?n." onRetry={orders.reload}><div className="table-scroll"><table><thead><tr><th>Orden</th><th>Proveedor</th><th>Fecha</th><th>Productos</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{orders.data?.map((order) => <tr key={order.id}><td className="mono"><strong>OC-{String(order.id).padStart(5, '0')}</strong></td><td>{order.supplier}</td><td>{new Date(order.date).toLocaleDateString('es-PE')}</td><td>{order.productCount}</td><td><strong>{money(order.total)}</strong></td><td><Badge tone={tone(order.status)}>{order.status}</Badge></td><td><div className="row-actions">{order.status === 'PENDIENTE' && <Button variant="small" onClick={() => changeStatus(order, 'APROBADA')}>Aprobar</Button>}{order.status === 'APROBADA' && <Button variant="small" onClick={() => changeStatus(order, 'ENVIADA')}>Marcar enviada</Button>}{order.status === 'ENVIADA' && <Button variant="small" onClick={() => openReception(order)}>Recepcionar</Button>}</div></td></tr>)}</tbody></table></div></PageState></section>
    {modal === 'order' && <Modal title="Nueva orden de compra" subtitle="Se registrará inicialmente como pendiente" onClose={() => setModal(null)} wide><form className="form-stack" onSubmit={create}><label>Proveedor<select required value={form.supplierId || ''} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}><option value="">Selecciona</option>{suppliers.data?.filter((supplier) => supplier.status === 'ACTIVO').map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name} · {supplier.ruc}</option>)}</select></label><div className="order-lines">{form.items.map((item, index) => <div className="order-form-line" key={index}><select required value={item.productId} onChange={(event) => changeItem(index, 'productId', event.target.value)}><option value="">Producto</option>{products.data?.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select><input required type="number" min="1" value={item.quantity} onChange={(event) => changeItem(index, 'quantity', event.target.value)} placeholder="Cantidad" /><input required type="number" min=".01" step=".01" value={item.price} onChange={(event) => changeItem(index, 'price', event.target.value)} placeholder="Precio compra" /></div>)}</div><Button variant="secondary" type="button" onClick={() => setForm({ ...form, items: [...form.items, { productId: '', quantity: 1, price: '' }] })}><Plus />Agregar producto</Button><label>Observación<textarea value={form.observation || ''} onChange={(event) => setForm({ ...form, observation: event.target.value })} /></label><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancelar</Button><Button>Crear orden</Button></div></form></Modal>}
    {modal === 'reception' && <Modal title="Recepcionar mercadería" subtitle={`Orden OC-${selected.id}`} onClose={() => setModal(null)} wide><form className="form-stack" onSubmit={receive}><div className="order-lines">{form.items.map((item, index) => {
      const detail = selected.details.find((row) => row.id === item.detailId);
      return <div className="reception-line" key={item.detailId}><span><strong>{detail.product}</strong><small>Pendiente: {detail.quantity - detail.receivedQuantity}</small></span><label>Cantidad<input type="number" min="1" max={detail.quantity - detail.receivedQuantity} value={item.quantity} onChange={(event) => changeItem(index, 'quantity', event.target.value)} /></label><label>Lote opcional<input value={item.lotNumber || ''} onChange={(event) => changeItem(index, 'lotNumber', event.target.value)} /></label><label>Vencimiento<input type="date" value={item.expirationDate || ''} onChange={(event) => changeItem(index, 'expirationDate', event.target.value)} /></label></div>;
    })}</div><label>Observación<textarea value={form.observation || ''} onChange={(event) => setForm({ ...form, observation: event.target.value })} /></label><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancelar</Button><Button><Check />Confirmar recepción</Button></div></form></Modal>}
    <Toast {...toast} />
  </div>;
}
