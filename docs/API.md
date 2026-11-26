# API REST

Base local: `http://localhost:4000/api`.

Todas las rutas salvo login y health requieren `Authorization: Bearer <JWT>`.

| Módulo | Rutas principales | Roles |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` | Público / autenticado |
| Dashboard | `GET /dashboard/resumen` | Autenticado |
| Productos | `GET/POST /productos`, `PUT /productos/:id` | Internos / catálogo |
| Categorías | `GET/POST /categorias`, `PUT /categorias/:id` | Internos / catálogo |
| Caja | `GET /caja/estado`, `POST /caja/apertura`, `POST /caja/cierre` | Cajero |
| Cierres | `GET /caja/cierres`, `GET /caja/cierres/:id` | Administrador |
| Ventas | `POST /ventas`, items, pagos, confirmar, anular | Cajero |
| Comprobantes | `POST/GET /comprobantes`, `GET /comprobantes/:id` | Cajero/Administrador |
| Inventario | `GET /inventario`, movimientos, alertas, lotes | Almacén |
| Proveedores | `GET/POST /proveedores`, `PUT /proveedores/:id` | Admin/Logística/Asistente |
| Órdenes | `GET/POST /ordenes-compra`, estado, recepción | Admin/Logística |
| Usuarios | `GET/POST /usuarios`, `PUT /usuarios/:id` | Administrador |
| Roles | `GET /roles` | Administrador |
| Reportes | `GET /reportes/:tipo` | Administrador |
| Configuración | `GET/PUT /configuracion` | Administrador |
| Auditoría | `GET /auditoria` | Administrador |
| Respaldos | `GET/POST /respaldos`, restaurar | Administrador |

## Integraciones externas

- Tarjeta/Yape/Plin: responde `503 INTEGRATION_NOT_CONFIGURED` mientras `PAYMENT_GATEWAY_ENABLED=false`.
- SUNAT: los comprobantes quedan `GENERADO`; la respuesta incluye `externalStatus: INTEGRACION_NO_CONFIGURADA`.
- RENIEC: no existe consulta falsa; DNI y datos se validan localmente.
- Respaldo: responde `503` si falta `BACKUP_DIR` o los binarios PostgreSQL.
