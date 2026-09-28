import { useState } from 'react';
import { loginRequest } from '../services/authService.js';
import { useAuth } from '../context/AuthContext.jsx';

const demos = [
  { label: 'Administrador', email: 'admin@nova.test' },
  { label: 'Cajero', email: 'cajero@nova.test' },
  { label: 'Almacén', email: 'almacen@nova.test' }
];
export default function LoginPage() {
  const { saveSession } = useAuth();
  const [email, setEmail] = useState('admin@nova.test');
  const [password, setPassword] = useState('NovaDemo123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const result = await loginRequest(email.trim(), password);
      saveSession({ token: result.token, user: result.user });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  return <main className="login-page">
    <section className="login-card">
      <div className="login-brand"><div className="brand-mark large">N</div><h1>NOVA MARKET</h1><p>Sistema de gestión de minimarket</p></div>
      <div className="login-form-wrap"><h2>Iniciar sesión</h2><p className="muted">Ingresa con una cuenta de demostración.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div className="error-message" role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar al sistema'}</button>
        </form>
        <div className="demo-box"><b>Acceso demo</b><p>Contraseña para todas las cuentas: <code>NovaDemo123!</code></p><div className="demo-buttons">{demos.map(demo => <button type="button" key={demo.email} onClick={() => { setEmail(demo.email); setPassword('NovaDemo123!'); }}>{demo.label}</button>)}</div></div>
      </div>
    </section>
    <p className="login-disclaimer">Prototipo académico · Usuarios ficticios · Datos de demostración</p>
  </main>;
}
