# Pruebas y verificaciones

## Suites automatizadas actuales

En PowerShell, desde cada paquete:

```powershell
cd backend
corepack pnpm test
corepack pnpm test:smoke  # requiere API y PostgreSQL activos
cd ..\frontend
corepack pnpm test
corepack pnpm build
```

Últimos resultados tras añadir cuenta demo y ampliar pruebas de usuarios, catálogo y factura:

- Backend: **12/12** aprobadas sobre `pg-mem`.
- Frontend: **5/5** aprobadas con Vitest/jsdom.
- Build Vite: correcto.
- Smoke API → PostgreSQL real: correcto.

Cobertura backend: health con base conectada, login inválido/válido, autorización, cuenta demo con bcrypt y sin hash en respuesta, alta de usuario persistida/hash/login, seed no crea la demo en producción, CRUD de categoría/producto y permisos, venta y stock, pagos, comprobante local, caja, alertas, reportes de productos y caja, órdenes/recepción/lotes y auditoría.

Cobertura frontend: error de login, sesión/restauración y permisos de ruta, POS conectado al cliente API, integraciones externas deshabilitadas, error/reintento y validación UI del RUC para factura.

## Verificación contra PostgreSQL 16 real

Comprobado en el entorno local de NOVA MARKET:

- Migraciones 001 y 002 aplicadas y repetidas sin duplicar versiones.
- Seed ejecutado más de una vez; roles/productos/usuarios no se duplicaron.
- 23 tablas públicas y 24 claves foráneas.
- Health API devolvió `database=connected`.
- Login de `yimi` y acceso autenticado a `/api/usuarios` devolvieron éxito; la API no devolvió `contrasena_hash`.
- Hash de `yimi` verificado como bcrypt sin leer ni registrar el hash.
- PostgreSQL sobrevivió a `docker compose restart` y a `docker compose down` + `up -d` sin borrar volumen.
- Frontend respondió HTTP 200.

Las pruebas funcionales detalladas de servicios usan pg-mem y no equivalen a pruebas E2E de todos los módulos contra PostgreSQL. El smoke test real cubre health/conexión, no todos los flujos de negocio.

## No verificado

- Flujos completos de navegador con PostgreSQL real para cada requisito F01–F37.
- Responsive visual automatizado, accesibilidad y pruebas E2E.
- SUNAT, RENIEC y proveedores financieros: no hay adaptadores/credenciales y se mantienen deshabilitados.
- `pg_dump`/`pg_restore`: los binarios no están disponibles en Windows PATH, así que no se ejecutó backup ni restore real.
- Integración HTTPS de producción.

El estado detallado por funcionalidad está en [AUDITORIA-FUNCIONAL.md](AUDITORIA-FUNCIONAL.md).
