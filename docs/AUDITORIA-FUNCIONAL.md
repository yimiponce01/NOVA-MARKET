# Auditoría funcional F01–F37

Fuente de requisitos: `NOVA_MARKET_Inventario_y_Plan_Actualizacion.xlsx`, hoja **Inventario funcional**. Los nombres, códigos, prioridades y textos de requisito de la tabla se conservan del Excel. El estado describe evidencia de código y pruebas encontrada; no equivale a certificación productiva.

## Diagnóstico

La solución dejó de ser el starter que describe la hoja **Auditoría ZIP**: ahora hay API Express, persistencia PostgreSQL, migraciones, seed, autenticación y módulos de negocio. La hoja se toma como inventario histórico, no como descripción vigente del código.

- **IMPLEMENTADA Y VERIFICADA:** 4 (F01, F13, F19, F23).
- **IMPLEMENTADA PARCIALMENTE:** 31.
- **NO IMPLEMENTADA:** 1 (F36).
- **BLOQUEADA POR DECISIÓN DE NEGOCIO:** 1 (F04).

La validación actual incluye backend **12/12**, frontend **5/5**, build Vite y smoke test API–PostgreSQL correctos. La suite backend corre sobre `pg-mem`; contra PostgreSQL 16 real se comprobaron migraciones, seed idempotente, conexión, login, ruta protegida y persistencia. No se ha hecho una prueba E2E completa de cada pantalla y flujo.

Brecha de seguridad F02: el JWT se guarda en `sessionStorage`, accesible desde JavaScript. La expiración y autorización backend se verifican, pero no se ha implementado una cookie HttpOnly/Secure; no declarar F02 como completo para producción.

## Inventario requisito por requisito

| Código | Requisito original | Estado | Evidencia | Brechas | Pruebas verificadas / pendientes | Prioridad | Decisiones pendientes |
|---|---|---|---|---|---|---|---|
| F01 | Inicio de sesión, validación, estados de carga/error | **IMPLEMENTADA Y VERIFICADA** | `frontend/src/pages/LoginPage.jsx`, `context/AuthContext.jsx`; `backend/src/routes/auth.routes.js`, `services/auth.service.js`; usuarios en PostgreSQL. | El despliegue local no configura HTTPS; requiere terminación TLS al publicar fuera de local. | Frontend cubre error y restauración; backend login inválido/protección; login real `yimi` en PostgreSQL y `/auth/me`. | Alta | Ninguna para el flujo local. |
| F02 | Contraseñas hash, sesiones/token expirables, HTTPS, fuerza bruta | **IMPLEMENTADA PARCIALMENTE** | bcrypt costo 12 en `services/auth.service.js` y `admin.service.js`; JWT con expiración; rate limit de login en `src/app.js`; middleware JWT/roles. | HTTPS no forma parte del entorno local; falta hardening productivo (TLS/proxy, política de despliegue y controles operativos). | Pruebas de login, token y permisos; faltan pruebas de límite de intentos y configuración de despliegue HTTPS. | Crítica | Infraestructura/TLS de producción. |
| F03 | Crear, editar, activar/desactivar usuarios | **IMPLEMENTADA PARCIALMENTE** | `src/routes/admin.routes.js`, `admin.service.js`; operaciones persisten en `usuario`. No devuelve hash. | Falta probar edición, desactivación, colisiones y validación de permisos en PostgreSQL real. | Prueba automatizada añadida: creación, hash bcrypt persistido, respuesta sin hash y login exitoso en pg-mem. | Alta | Ninguna para CRUD básico. |
| F04 | Administrador, Cajero, roles de almacén y permisos | **BLOQUEADA POR DECISIÓN DE NEGOCIO** | Roles seed en `src/services/seed.service.js`; autorización backend en `middlewares/auth.js` y rutas; mapa en `docs/API.md`. | La matriz implementada usa cinco roles del informe, pero la equivalencia entre roles de almacén/logística y los del Excel no está aprobada. | Prueba de rol no autorizado y acceso admin real de cuenta demo. Falta matriz completa de cada módulo/acción. | Crítica | D03: ¿mapear o separar Auxiliar de almacén, Logística y Encargado de Inventario? |
| F05 | KPIs: ventas día, transacciones, cajas abiertas, alertas | **IMPLEMENTADA PARCIALMENTE** | `admin.service.js:dashboardSummary`, `routes/dashboard.routes.js`, `frontend/src/pages/DashboardPage.jsx`; consultas PostgreSQL. | No hay verificación de cada KPI contra datos preparados en PostgreSQL real; falta validar filtros/periodos si se requieren. | Prueba frontend de carga/error; falta prueba funcional de los cuatro cálculos con fixtures PostgreSQL. | Alta | Confirmar periodos de negocio si se requieren distintos a “hoy”. |
| F06 | Ventas por hora / reportes accesibles | **IMPLEMENTADA PARCIALMENTE** | `dashboardSummary` agrupa ventas del día por hora; página Dashboard y rutas reportes en `admin.routes.js`. | No se ha verificado gráfico, filtros de periodo ni navegación a reportes en navegador. | Sin prueba específica de agrupación por hora ni enlaces de reportes. | Alta | Definir periodos/granularidad solo si difieren del día actual. |
| F07 | Buscar producto por código/nombre, agregar y cantidades | **IMPLEMENTADA PARCIALMENTE** | `frontend/src/pages/PosPage.jsx`; `catalog.service.js`; `sales.service.js` valida activo/stock, actualiza detalle y subtotal. | No hay E2E de búsqueda UI → API PostgreSQL → carrito; la prueba de UI usa API simulada. | Prueba backend de venta, subtotal, stock insuficiente y confirmación; prueba frontend de búsqueda/carrito en entorno simulado. | Crítica | Ninguna para flujo base. |
| F08 | Cliente opcional y validación DNI/RUC | **IMPLEMENTADA PARCIALMENTE** | POS captura nombre/DNI/RUC; `sales.routes.js` valida formatos; `Comprobante.js` valida factura/boleta; escritura en `cliente`. | No consulta RENIEC; éxito solo significa validación local. No hay E2E de alta de cliente real. | UI verifica bloqueo de factura con RUC incompleto; backend prueba factura sin RUC y la rechaza. | Alta | D04: no usar RENIEC real hasta definir servicio/credenciales. |
| F09 | Confirmar venta y calcular importes/IGV | **IMPLEMENTADA PARCIALMENTE** | `sales.service.js`: total de detalles, pagos exactos, transacción, bloqueo y descuento de inventario. | IGV se presenta como 18%; falta confirmar tratamiento tributario exacto y redondeo conforme a reglas del informe/negocio. | Flujo backend de total, pago, confirmación y stock en pg-mem; falta fixture equivalente en PostgreSQL real. | Crítica | D05: confirmar reglas de IGV, base imponible y redondeo. |
| F10 | Efectivo, tarjeta, Yape, Plin | **IMPLEMENTADA PARCIALMENTE** | Efectivo completo en `sales.service.js` y POS; métodos externos responden no configurado y permanecen deshabilitados. | Tarjeta/Yape/Plin no tienen adaptadores ni aceptación real. | Efectivo probado en flujo de venta; rechazo de Yape probado con integración deshabilitada. | Crítica | D04: alcance mock controlado, sandbox o proveedor real. |
| F11 | Pagos mixtos y vuelto | **IMPLEMENTADA PARCIALMENTE** | API permite registrar varios pagos y controla cada importe contra saldo; calcula vuelto en efectivo. | El POS aún cobra el saldo completo en efectivo y no ofrece composición de pagos; pagos externos siguen deshabilitados. | Se prueba efectivo insuficiente y rechazo de método externo; falta prueba de combinación y vuelto en UI/API. | Crítica | D04 para mezcla con medios electrónicos; confirmar si efectivo dividido cubre el caso requerido. |
| F12 | Boleta, factura, serie, número, estado | **IMPLEMENTADA PARCIALMENTE** | Modelo `Comprobante`; tabla canónica `comprobante`; correlativos bloqueados en `sales.service.js`; POS permite boleta/factura local. | No es comprobante electrónico SUNAT. Cardinalidad final y reglas de emisión deben coincidir con el informe. | Backend prueba factura y boleta local; prueba UI valida RUC antes de confirmar. No se verificó SUNAT. | Alta | D05: reglas y cardinalidad del comprobante; D04: integración SUNAT. |
| F13 | Apertura, monto inicial, turno | **IMPLEMENTADA Y VERIFICADA** | `cash.service.js`, `cash.routes.js`, `cierre_caja`, índice único `uq_turno_abierto`; página Caja. | Falta validación E2E con navegador y PostgreSQL real. | Suite backend prueba apertura, apertura duplicada y flujo de caja. | Crítica | Confirmar cantidad de cajas reales antes de operación. |
| F14 | Cierre, conteo denominaciones, diferencia, observación | **IMPLEMENTADA PARCIALMENTE** | `cash.service.js` calcula esperado/diferencia y exige observación; persiste apertura/cierre. | El conteo se registra como monto agregado; no hay detalle de denominaciones en modelo/API/UI. | Flujo backend comprueba cierre y diferencia; faltan pruebas para conteo por denominación porque no está implementado. | Crítica | Confirmar si el informe exige desglose por denominación o solo total contado. |
| F15 | Productos: código, nombre, descripción, precio | **IMPLEMENTADA PARCIALMENTE** | CRUD en `catalog.routes.js`/`catalog.service.js`, tabla `producto`, validadores y página administrativa/catálogo. | Falta prueba de códigos duplicados y edición de producto en PostgreSQL real/UI. | Prueba API crea/actualiza/busca producto y valida permisos en pg-mem; endpoint también se ejecutó contra PostgreSQL seed (7 filas, sin ventas reales). | Alta | Ninguna para campos enumerados. |
| F16 | Categorías | **IMPLEMENTADA PARCIALMENTE** | CRUD de categorías en `catalog.routes.js`/`catalog.service.js`; FK `producto.id_categoria`. | Falta probar edición de categoría e interacción desde interfaz/PostgreSQL real. | Prueba API crea categoría, verifica su FK desde producto y rechaza rol sin permiso en pg-mem; falta probar edición. | Media | Ninguna. |
| F17 | Stock actual/mínimo/máximo, ubicación, estado | **IMPLEMENTADA PARCIALMENTE** | Tabla `inventario` 1:1 con producto; `inventory.service.js`, rutas y página Inventario. | No se comprobó que UI/API cubra todos los campos y filtros de máximo/estado. | Migración y flujo de stock verificados; falta prueba por campo y UI. | Crítica | D03 para permisos definitivos de almacén. |
| F18 | Movimientos de entrada/salida/ajuste | **IMPLEMENTADA PARCIALMENTE** | `inventory.service.js`, `sales.service.js`, `procurement.service.js`; tabla `movimiento_inventario` con usuario, fecha, motivo y referencia. | Falta comprobar filtros y trazabilidad de todos los orígenes en PostgreSQL real. | Suite prueba ajuste y salida por venta; recepción prueba movimiento de entrada. | Crítica | Ninguna de esquema; permisos dependen de D03. |
| F19 | Alertas stock bajo/agotado | **IMPLEMENTADA Y VERIFICADA** | `stock-alert.service.js`, migración trigger `002_support_functions.sql`, `inventory.service.js` y página Alertas. | La alerta por vencimiento no está cubierta por este requisito de stock; requiere revisión en F20. | Prueba backend comprueba generación y atención de alerta por stock bajo. Trigger también forma parte de migración real aplicada. | Alta | Ninguna para stock mínimo; umbral usa `inventario.stock_minimo`. |
| F20 | Lotes, fechas ingreso/vencimiento | **IMPLEMENTADA PARCIALMENTE** | Tabla `lote`, recepción crea lote; `inventory.service.js:listLots` y vista de lotes. | No hay CRUD manual completo ni alerta automática demostrada de próximos vencimientos; días de anticipación siguen provisionales. | Suite verifica lote creado en recepción; falta caso de vencimiento próximo/expirado. | Alta | Confirmar DÍAS_ALERTA_VENCIMIENTO y flujo para lotes vencidos. |
| F21 | Proveedores | **IMPLEMENTADA PARCIALMENTE** | CRUD API en `procurement.routes.js`/`procurement.service.js`, tabla `proveedor` y página de abastecimiento. | Sin pruebas específicas de CRUD, RUC duplicado o edición en UI. | Sin prueba funcional específica; proveedor seed presente. | Media | Ninguna para operación técnica. |
| F22 | Orden de compra y detalle | **IMPLEMENTADA PARCIALMENTE** | `procurement.service.js` crea orden/detalles y calcula total; estados en tabla `orden_compra`; página Orders. | No se han verificado todos los cambios de estado y edición en UI. | Suite prueba creación y conservación de detalles; falta E2E contra PostgreSQL real. | Alta | La orden contiene uno o más detalles conforme al modelo documentado. |
| F23 | Recepción de mercadería | **IMPLEMENTADA Y VERIFICADA** | `receiveOrder` transaccional actualiza detalle, inventario, movimiento y lote; FKs preservadas. | Falta E2E de navegador/PostgreSQL real. | Suite prueba recepción, incremento de stock, movimiento y lote en pg-mem. | Crítica | Ninguna para recepción ordinaria. |
| F24 | Reporte ventas | **IMPLEMENTADA PARCIALMENTE** | `admin.service.js:report('ventas')`, endpoint `GET /api/reportes/ventas`, página Reportes. | No se verificaron filtros de fechas/totales en una base con ventas preparadas; exportación no implementada. | Sin prueba dedicada del reporte. | Alta | Definir exportación solo si forma parte del requisito final. |
| F25 | Reporte productos | **IMPLEMENTADA PARCIALMENTE** | `report('productos')` obtiene unidades/total por producto; endpoint y página Reportes. | La consulta ya excluye ventas no pagadas; falta confirmar definición de rotación/ranking y filtros de periodo. | Regresión en `integration.test.js` comprueba que borradores no sumen unidades ni total. | Media | Definir métrica de rotación/ranking según informe. |
| F26 | Reporte inventario | **IMPLEMENTADA PARCIALMENTE** | `report('inventario')` devuelve stock/valor; `listMovements` expone movimientos por otro endpoint. | El reporte no combina movimientos ni expone filtros documentados; falta verificar requisitos exactos. | Sin prueba dedicada del reporte. | Alta | Confirmar filtros/reporte de movimientos requeridos. |
| F27 | Reporte caja | **IMPLEMENTADA PARCIALMENTE** | `report('caja')`, reportes de cierres y `getShiftSummary` con pagos por método. | El reporte ya agrupa pagos aprobados por método y acepta filtros por fecha de apertura; falta comprobar cierres/fechas adicionales con PostgreSQL real. | Prueba de integración comprueba efectivo en pg-mem; endpoint consultó PostgreSQL real sin cierres (0 filas). Falta probar varios métodos/periodos con cierres reales. | Alta | Confirmar campos/periodos del reporte. |
| F28 | Registrar acciones críticas, usuario, fecha/hora, IP | **IMPLEMENTADA PARCIALMENTE** | `audit.service.js` y llamadas de ventas/caja/inventario/órdenes/admin; tabla `auditoria`; consulta admin. | Falta matriz de acciones completa y comprobación real de IP/proxy; auditoría no usa transacción compartida en todos los flujos. | Prueba automatizada revisa auditoría de operaciones críticas en pg-mem. | Alta | Definir confianza de IP si se opera detrás de proxy. |
| F29 | Configuraciones del sistema | **IMPLEMENTADA PARCIALMENTE** | `admin.service.js` limita claves editables; rutas admin y página de administración; `configuracion`. | No se ha comprobado UI completa ni que cada parámetro afecte la regla de negocio; IGV depende de D05. | Sin prueba específica de lectura/edición de configuración. | Media | Confirmar parámetros de negocio y sus valores. |
| F30 | Respaldo/restauración | **IMPLEMENTADA PARCIALMENTE** | API admin llama `pg_dump`/`pg_restore`, guarda metadatos; ruta de backup local. | `pg_dump` y `pg_restore` no están en PATH de Windows; operación real no pudo ejecutarse. Restaurar reemplaza objetos existentes. | Solo se probó respuesta “no configurado”/herramienta no disponible; falta backup y restore aislados. | Alta | Definir directorio, retención, RTO y autorización de restauración. |
| F31 | SUNAT/RENIEC/pasarelas | **BLOQUEADA POR DECISIÓN DE NEGOCIO** | Integraciones quedan explícitamente no configuradas; pagos no efectivo se rechazan y comprobantes son locales. | No existen adaptadores funcionales ni credenciales/sandbox; no hay consulta RENIEC ni aceptación externa. | Probado rechazo de pago externo; emisión local muestra estado no configurado. | Alta | D04: elegir preparación mock, sandbox o integración real y proveedor/credenciales. |
| F32 | Identidad visual NOVA (verdes, Poppins, sidebar, cards) | **IMPLEMENTADA PARCIALMENTE** | `frontend/src/styles/global.css`, `Logo.jsx`, `AppShell.jsx`; tema verde, sidebar y cards. | Logo oficial no está en el proyecto; fuente Poppins y comparación contra referencias no verificadas visualmente. | Build UI correcto; no hay validación visual automatizada ni recurso oficial. | Alta | D07: proporcionar logo oficial/referencia. |
| F33 | Navegación real entre módulos y menú por permisos | **IMPLEMENTADA PARCIALMENTE** | `App.jsx`, `ProtectedRoute.jsx`, `AppShell.jsx`, rutas y enlaces por rol; API revalida permisos. | Falta matriz completa UI/API y prueba de navegación de cada módulo/rol. | Frontend prueba bloqueo de ruta; backend prueba autorización. | Crítica | D03 para matriz final de roles. |
| F34 | Responsive desktop/tablet/móvil | **IMPLEMENTADA PARCIALMENTE** | Media queries en `global.css` (1120, 820, 600 px), sidebar móvil con apertura/cierre y scrim. | No hay prueba por viewport ni verificación de todos los flujos POS móvil; D06 pendiente. | Sin pruebas visuales/responsive automatizadas. | Alta | D06: funciones del POS permitidas/ajustadas en móvil. |
| F35 | Estados: vacío, carga, error, éxito, confirmación | **IMPLEMENTADA PARCIALMENTE** | `components/ui.jsx`, `hooks/useApi.js`, estados de páginas y toasts/modales. | Cobertura no uniforme demostrada para los 37 flujos; errores posteriores a confirmar venta pueden requerir recuperación manual. | Frontend prueba login con error, dashboard con error/reintento y estados POS. | Alta | Confirmar UX de recuperación si emisión de comprobante falla tras pago. |
| F36 | Prototipo Figma interactivo | **NO IMPLEMENTADA** | No hay archivo/enlace de Figma ni artefacto de prototipo en el workspace. | Falta crear prototipo navegable de módulos y variantes responsive; no se debe declarar la UI existente como prototipo Figma. | No probado. | Alta | D07: logo/referencias; confirmar cuenta/archivo Figma de destino y alcance. |
| F37 | Pruebas automatizadas y gates | **IMPLEMENTADA PARCIALMENTE** | `backend/tests/integration.test.js`, `frontend/src/test/app.test.jsx`, scripts `test`, `test:smoke`, build. | No hay lint/E2E navegador/PostgreSQL por cada requisito; cobertura F01–F37 incompleta. | Backend 12/12; frontend 5/5; build y smoke API/PostgreSQL aprobados en esta etapa. | Crítica | D09: confirmar gates mínimos; esta solicitud ya pide tests/build/smoke y se usaron como gates locales. |

## Decisiones de las hojas 3–5

- **D01 PostgreSQL en Docker Compose:** confirmado por la solicitud del proyecto; implementado y ejecutado.
- **D02 seed ficticio:** confirmado; seed idempotente. La cuenta especial `yimi` se crea solo en local/test y se omite en producción.
- **D03 roles:** sigue pendiente. La cuenta `yimi` usa el rol ya existente `ADMINISTRADOR`; no se renombraron otros roles.
- **D04 integraciones externas:** siguen sin alcance/proveedor/credenciales; se mantienen deshabilitadas.
- **D05 comprobantes e IGV:** boleta/factura local implementada; reglas tributarias y emisión electrónica quedan pendientes.
- **D06 POS móvil:** pendiente.
- **D07 logo oficial:** no incluido; pendiente.
- **D08 React/Vite, Node/Express y PostgreSQL:** confirmado y conservado.
- **D09 gates:** pruebas, build y smoke ejecutados; falta acordar si se requieren otros gates, lint y E2E.

## Contraste de las otras hojas del Excel

### Auditoría ZIP (hallazgos históricos)

| Área del Excel | Contraste con el workspace actual |
|---|---|
| Frontend | React/Vite se conserva en `frontend/`; no se reemplazó el stack. |
| Login | Ya consulta la API/PostgreSQL, maneja carga/error y usa JWT; `yimi` es una cuenta de desarrollo. |
| Dashboard | El resumen consulta ventas, cierres, alertas y actividad en PostgreSQL; no se toma el mock de la auditoría ZIP como estado vigente. |
| Menú | `App.jsx` y `AppShell.jsx` tienen rutas y enlaces; acceso backend también verifica roles. Falta matriz y navegación exhaustiva por rol. |
| Roles | El seed usa cinco roles; equivalencia frente a ADMIN/CASHIER/WAREHOUSE sigue D03. |
| Responsive | CSS incluye navegación móvil accesible con botón/scrim; faltan pruebas por viewport y decisión D06. |
| Backend | Conserva rutas/servicios/repositorios y añade PostgreSQL, migraciones, validación y pruebas. |
| Autenticación | Usa bcrypt, JWT expirables, rate limit y consultas PostgreSQL; token en sessionStorage queda como brecha F02. |
| Persistencia | PostgreSQL real en Docker; migraciones/seed aplicados y volumen probado. |
| Módulos negocio | Hay APIs para catálogo, ventas, caja, inventario, compras, reportes y administración; cobertura de cada subrequisito se desglosa en F01–F37. |
| Pruebas | Hay suites backend/frontend, build y smoke. No equivalen aún a E2E de cada módulo. |
| Logo/assets | Hay componente de marca e iconos; el logo oficial del Excel no está proporcionado (D07). |

### Plan de actualización (fases del Excel)

| Fase original | Estado actual observado |
|---|---|
| 0. Definición | Parcial: D01/D02/D08 confirmadas; D03–D07 mantienen preguntas abiertas. |
| 1. Diseño Figma | Pendiente: no existe prototipo Figma ni archivo de destino confirmado. |
| 2. Base y arquitectura | Implementada y verificada localmente: PostgreSQL Compose, esquema, migraciones, seed, env, health y API. |
| 3. Implementación módulos core | Parcial: módulos y flujos principales existen; brechas y pruebas se listan en F01–F23. |
| 4. Reportes y administración | Parcial: reportes/admin/auditoría/respaldos existen en código; varios carecen de pruebas operativas y backup requiere utilidades. |
| 5. Calidad y hardening | Parcial: tests/build/smoke pasan; faltan E2E, responsive, accesibilidad, TLS productivo y pruebas backup/restore. |
| 6. Entrega | Parcial: documentación y `.env.example` actualizados; no se crea ZIP ni se versiona; el workspace no contiene repositorio Git. |

### Relaciones de dominio (hoja 5)

| Origen → destino del Excel | Relación indicada en el Excel | Evidencia actual / observación |
|---|---|---|
| Venta → Cliente | 0..1 cliente por venta (según diagramas) | `venta.id_cliente` nullable FK; cardinalidad indicada sigue por confirmar. |
| Venta → Usuario | Usuario registra ventas | `venta.id_usuario` FK obligatoria. |
| Venta → Caja | Venta asociada a caja | `venta.id_caja` FK obligatoria. |
| Venta → DetalleVenta | Composición; una venta contiene detalles | FK `detalle_venta.id_venta`, cascade al borrar; el servicio opera detalles transaccionalmente. |
| Venta → Pago | Composición; venta tiene pagos; pagos mixtos contemplados | FK `pago.id_venta`; múltiples filas admitidas. |
| Venta → Comprobante | Venta genera comprobante; Boleta/Factura heredan Comprobante | FK `comprobante.id_venta`; tabla única con discriminador `tipo`; cardinalidad exacta pendiente D05. |
| DetalleVenta → Producto | Detalle refiere producto | FK `detalle_venta.id_producto`. |
| Caja → CierreCaja | Caja/turnos y cierres asociados | FK `cierre_caja.id_caja`; índice parcial limita un turno abierto por caja. |
| Producto → Categoría | Producto clasificado en categoría | FK obligatoria `producto.id_categoria`; CRUD/API probado en pg-mem. |
| Producto → Inventario | Relación 1:1 en diagrama | `inventario.id_producto` UNIQUE FK; creación de producto crea inventario. |
| Inventario → MovimientoInventario | Inventario registra movimientos | Movimiento referencia producto (`id_producto` FK), cantidad/fecha/motivo/referencia. |
| Inventario → AlertaStock | Inventario genera alertas | Alerta refiere producto; servicio y trigger calculan umbrales. |
| Proveedor → OrdenCompra | Proveedor recibe órdenes; relación proveedor-orden | `orden_compra.id_proveedor` FK. |
| OrdenCompra → DetalleOrdenCompra | Composición | `detalle_orden_compra.id_orden` FK con cascade. |
| DetalleOrdenCompra → Producto | Detalle solicita producto | FK `detalle_orden_compra.id_producto`. |
| Reporte → Reportes especializados | Reporte abstracto; Ventas/Productos/Inventario/Caja | Una tabla `reporte` almacena tipo; sin tablas especializadas. |
| Usuario → Auditoría | Usuario genera registros de auditoría | `auditoria.id_usuario` FK nullable para eventos sistema. |
| Producto → Lote | Producto registra lotes | FK `lote.id_producto`; recepción enlaza lote a orden. |

## Siguiente etapa recomendada

1. Resolver las decisiones D03–D06 que bloquean permisos definitivos, cálculo tributario, pagos y UX móvil.
2. Añadir pruebas UI/API para F03, F05–F12 y F15–F30 donde la tabla indica brechas, empezando por venta/cliente/comprobante y caja.
3. Verificar CRUD y reportes con fixtures de PostgreSQL real.
4. Instalar utilidades cliente PostgreSQL para probar F30 con una base temporal aislada.
5. Completar Figma y pruebas responsive cuando estén disponibles logo, referencias y destino.
