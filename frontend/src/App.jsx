import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';

function AppContent() {
  const { session } = useAuth();
  return session ? <DashboardLayout /> : <LoginPage />;
}
export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
