import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
export default function ForbiddenPage() {
  return <main className="standalone-state"><ShieldCheck /><h1>Acceso no autorizado</h1><p>Tu rol no tiene permiso para abrir este módulo.</p><Link className="btn btn-primary" to="/">Volver al inicio</Link></main>;
}
