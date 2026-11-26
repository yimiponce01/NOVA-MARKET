import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, roles }) {
  const { session, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div className="app-loading"><span className="spinner dark" />Validando sesión</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(session.user.rol)) return <Navigate to="/403" replace />;
  return children;
}
