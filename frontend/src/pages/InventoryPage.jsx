import { Box, Filter, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Modal, PageState, Toast } from '../components/ui.jsx';
import { useApi, useQuery } from '../hooks/useApi.js';
import { money } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function InventoryPage() {
  const { session } = useAuth();
  const [q, setQ] = useState('');
  const inventory = useQuery(`/inventario?q=${encodeURIComponent(q)}`, [q]);
  const products = useQuery(`/productos?q=${encodeURIComponent(q)}`, [q]);
  const categories = useQuery('/categorias');
  const api = useApi();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const notify = (message, type = 'success') => { setToast({ message, type }); window.setTimeout(() => setToast({ message: '', type }), 3000); };
  const submitMovement = async (event) => {
    event.preventDefault();
    try {
      await api('/inventario/movimientos', { method: 'POST', body: {
        productId: Number(form.productId), type: form.type || 'INGRESO', adjustment: form.adjustment || undefined,
        quantity: Number(form.quantity), reason: form.reason, reference: form.reference || undefined,
      } });
      setModal(null); setForm({}); await inventory.reload(); await products.reload(); notify('Movimiento registrado.');
    } catch (error) { notify(error.message, 'error'); }
  };
  const submitProduct = async (event) => {
    event.preventDefault();
    try {
      await api('/productos', { method: 'POST', body: {
        categoryId: Number(form.categoryId), code: form.code, name: form.name, description: form.description || undefined,
        price: Number(form.price), minimumStock: Number(form.minimumStock), initialStock: Number(form.initialStock || 0), location: form.location || undefined,
      } });
      setModal(null); setForm({}); await inventory.reload(); await products.reload(); notify('Producto creado.');
    } catch (error) { notify(error.message, 'error'); }
  };
  const tone = (status) => status === 'AGOTADO' ? 'danger' : status === 'STOCK_BAJO' ? 'warning' : 'success';
  const canMove = ['ADMINISTRADOR', 'ENCARGADO_INVENTARIO'].includes(session.user.rol);
  const canCreateProduct = ['ADMINISTRADOR', 'ASISTENTE_ADMINISTRATIVO', 'ENCARGADO_INVENTARIO'].includes(session.user.rol);
  return <div className="page-stack"><section className="section-heading"><div><span className="eyebrow">ALMACÉN · INVENTARIO</span><h2>Stock disponible</h2><p>Existencias, mínimos y ubicación consultados desde PostgreSQL.</p></div>{(canMove || canCreateProduct) && <div className="heading-actions">{canMove && <Button variant="secondary" onClick={() => { setForm({ type: 'INGRESO' }); setModal('movement'); }}><Plus />Registrar movimiento</Button>}{canCreateProduct && <Button onClick={() => { setForm({}); setModal('product'); }}><Plus />Nuevo producto</Button>}</div>}</section>
    <div className="mini-stats"><div><Box /><span><strong>{inventory.data?.reduce((sum, row) => sum + row.stock, 0) || 0}</strong>Unidades disponibles</span></div><div><Filter /><span><strong>{inventory.data?.filter((row) => row.status === 'STOCK_BAJO').length || 0}</strong>Stock bajo</span></div><div><Box /><span><strong>{inventory.data?.filter((row) => row.status === 'AGOTADO').length || 0}</strong>Agotados</span></div></div>
    <section className="panel"><div className="filter-row"><div className="input-icon grow"><Search /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por nombre o código" /></div></div><PageState loading={inventory.loading} error={inventory.error} empty={!inventory.data?.length} emptyTitle="No hay productos de inventario" emptyMessage="Registra productos y su existencia inicial para comenzar el seguimiento de stock." onRetry={inventory.reload}><div className="table-scroll"><table><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Ubicación</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>{inventory.data?.map((row) => <tr key={row.id}><td className="mono">{row.code}</td><td><strong>{row.name}</strong></td><td>{row.category}</td><td>{row.location || '—'}</td><td><strong>{row.stock}</strong></td><td>{row.minimumStock}</td><td><Badge tone={tone(row.status)}>{row.status.replace('_', ' ')}</Badge></td></tr>)}</tbody></table></div></PageState></section>
    {modal === 'movement' && <Modal title="Registrar movimiento" subtitle="Ingreso o ajuste manual auditado" onClose={() => setModal(null)}><form className="form-stack" onSubmit={submitMovement}><label>Producto<select required value={form.productId || ''} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Selecciona</option>{products.data?.map((product) => <option value={product.id} key={product.id}>{product.name} · stock {product.stock}</option>)}</select></label><div className="form-grid two"><label>Tipo<select value={form.type || 'INGRESO'} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>INGRESO</option><option>AJUSTE</option></select></label>{form.type === 'AJUSTE' && <label>Sentido<select value={form.adjustment || 'POSITIVO'} onChange={(event) => setForm({ ...form, adjustment: event.target.value })}><option>POSITIVO</option><option>NEGATIVO</option></select></label>}<label>Cantidad<input required type="number" min="1" value={form.quantity || ''} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>Referencia<input value={form.reference || ''} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></label></div><label>Motivo<textarea required value={form.reason || ''} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancelar</Button><Button>Registrar movimiento</Button></div></form></Modal>}
    {modal === 'product' && <Modal title="Nuevo producto" subtitle="Código único y stock inicial" onClose={() => setModal(null)} wide><form className="form-stack" onSubmit={submitProduct}><div className="form-grid two"><label>Código de barras<input required value={form.code || ''} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label><label>Nombre<input required value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Categoría<select required value={form.categoryId || ''} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Selecciona</option>{categories.data?.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Precio de venta<input required type="number" min=".01" step=".01" value={form.price || ''} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label><label>Stock mínimo<input required type="number" min="0" value={form.minimumStock || ''} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /></label><label>Stock inicial<input type="number" min="0" value={form.initialStock || ''} onChange={(event) => setForm({ ...form, initialStock: event.target.value })} /></label><label>Ubicación<input value={form.location || ''} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label></div><p className="form-note">El precio histórico de ventas previas no cambia cuando este precio sea actualizado.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancelar</Button><Button>Crear producto</Button></div></form></Modal>}
    <Toast {...toast} />
  </div>;
}
