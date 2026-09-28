# NOVA MARKET — starter académico

Estructura inicial separada en `frontend` y `backend`, con login demo y control de acceso básico por rol.

## Requisitos
- Node.js 20+ (recomendado)
- npm

## Ejecutar
Abre dos terminales desde la carpeta `NOVA-MARKET`.

### Terminal 1 — backend
```bash
cd backend
npm install
npm run dev
```
API: http://localhost:4000

### Terminal 2 — frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend: http://localhost:5173

## Cuentas demo
Todas usan la contraseña `NovaDemo123!`
- `admin@nova.test` — Administrador
- `cajero@nova.test` — Cajero
- `almacen@nova.test` — Logística de almacén

El login es únicamente demostrativo: usuarios en memoria, sin base de datos ni hashing. No usar en producción.

## Qué incluye
- Login/logout conectado al backend.
- Sesión demo guardada en `sessionStorage`.
- Rutas protegidas en frontend.
- Navegación y panel básico según rol.
- Backend separado en routes, controllers, services, repositories, interfaces, middleware y validators.
- Prueba de salud en `/api/health`.

## Próximos pasos
1. Añadir persistencia (Excel solo para demo o base de datos real).
2. Implementar productos, ventas e inventario.
3. Añadir pruebas, validación robusta y seguridad de producción.
4. Alinear roles, casos de uso y diagramas con la guía del curso.
