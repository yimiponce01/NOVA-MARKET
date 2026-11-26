import { AlertTriangle, Check, X } from 'lucide-react';

export function Badge({ children, tone = 'success' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Button({ variant = 'primary', className = '', children, ...props }) {
  return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>;
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X /></button></header>
      {children}
    </section>
  </div>;
}

export function PageState({ loading, error, empty, emptyTitle = 'Sin registros todavía', emptyMessage, onRetry, children }) {
  if (loading) return <div className="state-card"><span className="spinner dark" /><h3>Cargando información</h3></div>;
  if (error) return <div className="state-card error-state"><AlertTriangle /><h3>No se pudo cargar</h3><p>{error}</p>{onRetry && <Button onClick={onRetry}>Reintentar</Button>}</div>;
  if (empty) return <div className="state-card"><h3>{emptyTitle}</h3><p>{emptyMessage || 'Prueba cambiando los filtros o registra un nuevo elemento.'}</p></div>;
  return children;
}

export function InlineMessage({ type = 'info', children }) {
  return <div className={`inline-message ${type}`}>{type === 'error' ? <AlertTriangle /> : <Check />}{children}</div>;
}

export function Toast({ message, type = 'success' }) {
  if (!message) return null;
  return <div className={`toast ${type}`} role="status">{type === 'error' ? <AlertTriangle /> : <Check />}{message}</div>;
}
