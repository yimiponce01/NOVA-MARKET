import { useAuth } from '../context/AuthContext.jsx';
export default function ProtectedView({ children }) {
  const { session } = useAuth();
  return session ? children : null;
}
