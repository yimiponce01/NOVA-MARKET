# Seguimiento de pendientes

El Excel `NOVA_MARKET_Inventario_y_Plan_Actualizacion.xlsx` sigue siendo la referencia de requisitos. La evaluación individual de F01–F37 está en [AUDITORIA-FUNCIONAL.md](AUDITORIA-FUNCIONAL.md). No se ha alterado el modelo ni se han inventado las decisiones aún pendientes.

## Entorno y persistencia

| Tarea | Estado | Evidencia |
|---|---|---|
| Dependencias | Hecho | pnpm 10.34.3, instalaciones congeladas desde lockfiles. |
| PostgreSQL Compose | Hecho | PostgreSQL 16 saludable en localhost:5433; 5432 sigue ocupado por el contenedor ajeno `mi_postgres`, que quedó intacto. |
| Persistencia | Verificada | Volumen `nova-market-postgres-data`; sobrevivió a `docker compose restart` y a `docker compose down` + `up -d` sin `-v`. |
| Migraciones | Aplicadas | 001 y 002; 23 tablas públicas, 24 FKs y 2 versiones registradas. |
| Seed | Aplicado e idempotente | 5 roles, 7 productos y usuarios iniciales, incluida la cuenta local `yimi`; repetido sin duplicar. |
| Backend y login | Verificado | `/api/health` indica conexión PostgreSQL; login `yimi` y ruta admin protegida probados contra PostgreSQL. |
| Cuenta nueva | Verificada | API de creación persiste bcrypt; la respuesta no incluye hash y la cuenta puede autenticarse (prueba automatizada pg-mem). |
| Backups | Código implementado; ejecución pendiente | Requiere `pg_dump` y `pg_restore` en PATH; no están instalados en Windows. Restaurar reemplaza objetos existentes. |

## Última calidad ejecutada

- Backend: **12/12** pruebas.
- Frontend: **5/5** pruebas.
- Build Vite: correcto.
- `pnpm test:smoke`: correcto con API y PostgreSQL reales.
- Verificación adicional real: migraciones, seed repetido, health, login/sesión protegida, estado/rol/hash bcrypt de `yimi`, persistencia de filas después de reiniciar y bajar/subir Compose.

Las suites funcionales usan pg-mem; no sustituyen la verificación E2E completa con navegador y PostgreSQL real. El detalle de cobertura por requisito y sus brechas está en la auditoría.

## Cuenta de demostración

El seed local crea/ajusta únicamente `yimi`, con rol `ADMINISTRADOR`, estado activo y nombre `Usuario Demo Local`. La clave se toma de `DEMO_USER_PASSWORD` en `backend/.env`, queda fuera del repositorio y el seed no crea esta cuenta cuando `NODE_ENV=production`. No se documenta una contraseña débil para producción.

## Fixtures de demostración local (26/11/2026)

`backend/scripts/seed-demo.js`, invocable con `corepack pnpm seed:demo`, agrega datos claramente ficticios e identificables: 3 productos/categoría DEMO, usuario `demo_cajero`, proveedor/cliente de muestra, una orden pendiente y otra recibida con lote y movimiento, una venta en efectivo pagada, comprobante local serie `D001`, un cierre y un turno abierto para el POS. No afecta a los 7 productos preexistentes. La recepción agrega 5 unidades al producto DEMO y la venta descuenta solo productos DEMO. El seed se ejecutó dos veces; la consulta mostró una venta, un comprobante, dos órdenes y una apertura/cierre de muestra sin duplicados.

Conteos PostgreSQL finales consultados: producto 10, categoria 6, usuario 6, rol 5, cliente 1, proveedor 2, venta 1, detalle_venta 2, pago 1, comprobante 1, cierre_caja 2, orden_compra 2, detalle_orden_compra 3, inventario 10, alerta_stock 4, movimiento_inventario 3, lote 1, auditoria 1 y reporte 4. Configuracion conserva sus seis filas; no se agregó ni eliminó configuración.

El comprobante tiene estado `GENERADO` y no fue enviado a SUNAT. No se crearon datos de tarjeta, Yape, Plin, RENIEC ni exportación tributaria. La cuenta `demo_cajero` reutiliza `DEMO_USER_PASSWORD` local; el valor no se escribe en documentación ni código.

Mensajes vacíos más específicos se configuraron para inventario, alertas, órdenes, comprobantes, cierres y usuarios. La vista de backups sigue dependiendo de `pg_dump`/`pg_restore` instalados y no se generó un backup ficticio.

Verificación de esta etapa: backend 12/12, frontend 5/5, build Vite aprobado, smoke API→PostgreSQL aprobado; logins y `/auth/me` de `yimi` y `demo_cajero` respondieron 200. Compose reportó PostgreSQL 16 saludable en `localhost:5433`. `corepack pnpm` 10.34.3 no se pudo invocar porque Corepack no puede crear su caché en AppData bajo los permisos actuales; las pruebas se ejecutaron con `npm.cmd` usando las dependencias ya instaladas. No se ejecutó instalación de dependencias.

## Decisiones pendientes

- D03: equivalencia de roles de almacén/logística e inventario; no renombrar ni cambiar permisos sin decisión.
- D04: alcance y proveedores para SUNAT, RENIEC, tarjetas, Yape y Plin; se mantienen deshabilitados.
- D05: reglas finales de IGV/comprobante y cardinalidad; boleta/factura solo se generan localmente.
- D06: funciones permitidas del POS móvil.
- D07: logo original/referencias y destino del prototipo Figma.
- D09: gates adicionales como lint y cobertura E2E.
- Anticipación real de vencimientos, número de cajas, datos tributarios del negocio, RTO/retención/exportaciones.

## Próximos pasos

1. Continuar con las brechas críticas de F07–F12 y completar sus pruebas UI/API.
2. Validar CRUD, inventario, abastecimiento, reportes y administración contra PostgreSQL con casos de datos preparados.
3. Probar backups con herramientas PostgreSQL en un entorno de prueba aislado.
4. Resolver decisiones D03–D07 antes de alterar permisos, reglas tributarias o comportamiento móvil.
