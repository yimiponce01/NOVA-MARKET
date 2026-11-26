import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';

const json = (data, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(status >= 400 ? data : { success: true, data, message: 'ok' }),
});

describe('NOVA MARKET frontend', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('muestra login y comunica errores reales del API', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ message: 'Usuario o contraseña incorrectos.', code: 'INVALID_CREDENTIALS' }, 401)));
    render(<App />);
    expect(screen.getByRole('heading', { name: /bienvenido de nuevo/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/usuario o correo/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'Incorrecta1!' } });
    fireEvent.click(screen.getByRole('button', { name: /ingresar al sistema/i }));
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument();
  });

  it('restaura sesión y bloquea un módulo sin permiso', async () => {
    sessionStorage.setItem('nova-session', JSON.stringify({
      token: 'cashier-token',
      user: { id_usuario: 2, nombre: 'María', apellido: 'López', usuario: 'mlopez', rol: 'CAJERO', estado: 'ACTIVO' },
    }));
    window.history.pushState({}, '', '/admin/usuarios');
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).endsWith('/auth/me')) return json({ id_usuario: 2, nombre: 'María', apellido: 'López', usuario: 'mlopez', rol: 'CAJERO', estado: 'ACTIVO' });
      return json({});
    }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: /acceso no autorizado/i })).toBeInTheDocument();
  });

  it('carga POS desde API y deja integraciones financieras deshabilitadas', async () => {
    sessionStorage.setItem('nova-session', JSON.stringify({
      token: 'cashier-token',
      user: { id_usuario: 2, nombre: 'María', apellido: 'López', usuario: 'mlopez', rol: 'CAJERO', estado: 'ACTIVO' },
    }));
    window.history.pushState({}, '', '/pos');
    vi.stubGlobal('fetch', vi.fn((url) => {
      const value = String(url);
      if (value.endsWith('/auth/me')) return json({ id_usuario: 2, nombre: 'María', apellido: 'López', usuario: 'mlopez', rol: 'CAJERO', estado: 'ACTIVO' });
      if (value.endsWith('/caja/estado')) return json({ shiftId: 1, cashRegisterId: 1, code: 'CAJA-01', initialAmount: 200 });
      if (value.endsWith('/productos')) return json([{ id: 1, code: '7750001', name: 'Arroz extra', price: 24.9, stock: 10, minimumStock: 2, category: 'Abarrotes', status: 'DISPONIBLE' }]);
      return json({});
    }));
    render(<App />);
    expect(await screen.findByText(/tarjeta, yape y plin permanecen deshabilitados/i)).toBeInTheDocument();
    expect(screen.getByText('API conectada')).toBeInTheDocument();
  });

  it('valida los datos de factura antes de confirmar el cobro', async () => {
    sessionStorage.setItem('nova-session', JSON.stringify({
      token: 'cashier-token',
      user: { id_usuario: 2, nombre: 'María', apellido: 'López', usuario: 'mlopez', rol: 'CAJERO', estado: 'ACTIVO' },
    }));
    window.history.pushState({}, '', '/pos');
    vi.stubGlobal('fetch', vi.fn((url) => {
      const value = String(url);
      if (value.endsWith('/auth/me')) return json({ id_usuario: 2, nombre: 'María', apellido: 'López', usuario: 'mlopez', rol: 'CAJERO', estado: 'ACTIVO' });
      if (value.endsWith('/caja/estado')) return json({ shiftId: 1, cashRegisterId: 1, code: 'CAJA-01', initialAmount: 200 });
      if (value.endsWith('/productos')) return json([{ id: 1, code: '7750001', name: 'Arroz extra', price: 24.9, stock: 10, minimumStock: 2, category: 'Abarrotes', status: 'DISPONIBLE' }]);
      if (value.endsWith('/ventas')) return json({ id: 10, total: 24.9, pending: 24.9, items: [] });
      if (value.endsWith('/ventas/10/items')) return json({ id: 10, total: 24.9, pending: 24.9, items: [{ id: 5, productId: 1, quantity: 1, price: 24.9, subtotal: 24.9 }] });
      return json({});
    }));
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/buscar por/i), { target: { value: 'Arroz' } });
    fireEvent.click(await screen.findByRole('button', { name: /arroz extra/i }));
    fireEvent.click(await screen.findByRole('button', { name: /cobrar ahora/i }));
    fireEvent.change(screen.getByLabelText(/tipo de comprobante/i), { target: { value: 'FACTURA' } });
    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: 'Comercial de prueba' } });
    fireEvent.change(screen.getByLabelText(/ruc/i), { target: { value: '2012345' } });
    const submit = screen.getByRole('button', { name: /confirmar y emitir factura/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/ruc/i), { target: { value: '20123456789' } });
    expect(submit).toBeEnabled();
  });

  it('muestra un estado de error y permite reintentar', async () => {
    sessionStorage.setItem('nova-session', JSON.stringify({
      token: 'admin-token',
      user: { id_usuario: 1, nombre: 'Carlos', apellido: 'Ramos', usuario: 'admin', rol: 'ADMINISTRADOR', estado: 'ACTIVO' },
    }));
    window.history.pushState({}, '', '/dashboard');
    let dashboardCalls = 0;
    vi.stubGlobal('fetch', vi.fn((url) => {
      const value = String(url);
      if (value.endsWith('/auth/me')) return json({ id_usuario: 1, nombre: 'Carlos', apellido: 'Ramos', usuario: 'admin', rol: 'ADMINISTRADOR', estado: 'ACTIVO' });
      if (value.endsWith('/dashboard/resumen')) {
        dashboardCalls += 1;
        return dashboardCalls === 1 ? json({ message: 'Base de datos no disponible.' }, 503) : json({ salesToday: 0, transactions: 0, openCashRegisters: 0, activeAlerts: 0, salesByHour: [], recentActivity: [] });
      }
      return json({});
    }));
    render(<App />);
    expect(await screen.findByText('Base de datos no disponible.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(screen.getByText(/ventas por hora/i)).toBeInTheDocument());
  });
});
