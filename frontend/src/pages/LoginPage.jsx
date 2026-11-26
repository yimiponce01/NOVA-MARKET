import { useState } from 'react';
import { LockKeyhole, UserRound } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';
import { Badge, InlineMessage } from '../components/ui.jsx';

export default function LoginPage() {
  const { session, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const result = await login(username.trim(), password);
      const fallback = result.user.rol === 'CAJERO' ? '/pos' : result.user.rol === 'ADMINISTRADOR' ? '/dashboard' : '/inventario';
      navigate(location.state?.from?.pathname || fallback, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  if (session) return <Navigate to={session.user.rol === 'CAJERO' ? '/pos' : '/dashboard'} replace />;
  return <main className="login-page"><div className="login-orb one" /><div className="login-orb two" />
    <form className="login-card" onSubmit={handleSubmit}>
      <Logo />
      <div className="login-heading"><Badge>Acceso seguro</Badge><h1>Bienvenido de nuevo</h1><p>Ingresa con una cuenta registrada en NOVA MARKET.</p></div>
      <label htmlFor="username">Usuario o correo<div className="input-icon"><UserRound /><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="usuario o correo" required autoFocus /></div></label>
      <label htmlFor="password">Contraseña<div className="input-icon"><LockKeyhole /><input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" required /></div></label>
      {error && <InlineMessage type="error">{error}</InlineMessage>}
      <button className="btn btn-primary btn-full" disabled={loading}>{loading ? <><span className="spinner" />Verificando</> : 'Ingresar al sistema'}</button>
      <p className="login-help">Las cuentas se crean con <code>pnpm seed</code>. La contraseña no se incluye en el repositorio.</p>
      <footer>NOVA MARKET · Tingo María</footer>
    </form>
  </main>;
}
