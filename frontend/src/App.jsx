import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './layouts/AppShell.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PosPage from './pages/PosPage.jsx';
import CashPage from './pages/CashPage.jsx';
import ReceiptsPage from './pages/ReceiptsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ForbiddenPage from './pages/ForbiddenPage.jsx';

const Guard = ({ roles, children }) => <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;

function HomeRedirect() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.rol === 'CAJERO') return <Navigate to="/pos" replace />;
  if (session.user.rol === 'ADMINISTRADOR') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/inventario" replace />;
}

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/403" element={<ForbiddenPage />} />
    <Route element={<Guard><AppShell /></Guard>}>
      <Route path="/dashboard" element={<Guard roles={['ADMINISTRADOR']}><DashboardPage /></Guard>} />
      <Route path="/pos" element={<Guard roles={['CAJERO']}><PosPage /></Guard>} />
      <Route path="/caja" element={<Guard roles={['CAJERO', 'ADMINISTRADOR']}><CashPage /></Guard>} />
      <Route path="/comprobantes" element={<Guard roles={['CAJERO', 'ADMINISTRADOR']}><ReceiptsPage /></Guard>} />
      <Route path="/inventario" element={<Guard roles={['ADMINISTRADOR', 'LOGISTICA_ALMACEN', 'ENCARGADO_INVENTARIO', 'ASISTENTE_ADMINISTRATIVO']}><InventoryPage /></Guard>} />
      <Route path="/alertas" element={<Guard roles={['ADMINISTRADOR', 'LOGISTICA_ALMACEN', 'ENCARGADO_INVENTARIO']}><AlertsPage /></Guard>} />
      <Route path="/ordenes" element={<Guard roles={['ADMINISTRADOR', 'LOGISTICA_ALMACEN']}><OrdersPage /></Guard>} />
      <Route path="/admin/usuarios" element={<Guard roles={['ADMINISTRADOR']}><AdminPage section="users" /></Guard>} />
      <Route path="/admin/reportes" element={<Guard roles={['ADMINISTRADOR']}><AdminPage section="reports" /></Guard>} />
      <Route path="/admin/configuracion" element={<Guard roles={['ADMINISTRADOR']}><AdminPage section="config" /></Guard>} />
      <Route path="/admin/auditoria" element={<Guard roles={['ADMINISTRADOR']}><AdminPage section="audit" /></Guard>} />
    </Route>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}
