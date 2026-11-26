# Correspondencia con los diagramas

## Ventas, caja, pagos y comprobantes

- `Usuario` pertenece a un `Rol`.
- `Usuario` registra muchas `Venta` y es responsable de turnos `CierreCaja`.
- `Cliente` es opcional en `Venta`.
- `Venta` compone uno o más `DetalleVenta`; cada detalle corresponde a un `Producto`.
- `Venta` registra uno o más `Pago`.
- `Venta` genera comprobantes.
- `Caja` tiene muchos turnos de apertura/cierre, con un único turno abierto por caja.
- Estados de venta: `EN_PROCESO`, `PAGADA`, `ANULADA`.
- Métodos: `EFECTIVO`, `TARJETA`, `YAPE`, `PLIN`.

`Comprobante` se representa mediante una clase base y las clases `Boleta` y `Factura`. Se usa persistencia de tabla única con discriminador `tipo`, como establece el DDL. No se inventaron tablas para las subclases.

## Inventario, abastecimiento y administración

- `Proveedor` tiene muchas `OrdenCompra`.
- `OrdenCompra` compone uno o más `DetalleOrdenCompra`.
- Cada detalle solicita un `Producto`.
- `Producto` pertenece a una `Categoria` y controla un único `Inventario`.
- `Inventario` registra muchos `MovimientoInventario` y genera `AlertaStock`.
- `Producto` registra muchos `Lote`.
- `Usuario` ejecuta movimientos, genera reportes y auditorías.
- `Reporte` se materializa por tipo sin alterar la herencia conceptual del diagrama.
- `Configuracion` y `Respaldo` se mantienen como complementos administrativos.

## Decisiones explícitas

1. `comprobante` es la fuente canónica. Los campos de serie/número de `venta` se conservan por compatibilidad y se completan al emitir.
2. `inventario.stock_minimo` es el valor operativo. `producto.stock_minimo` se conserva y ambos se actualizan juntos.
3. `cierre_caja` representa el turno completo desde apertura hasta cierre.
4. Se añadió `cantidad_recibida` a `detalle_orden_compra` para conservar la validación de recepción sin inventar una entidad no documentada.
5. Se añadió `observacion` a `cierre_caja` porque RF-17 la exige.
6. No se creó una entidad “línea de producto”; el informe la deja pendiente.
7. El seed usa 30 días como valor técnico editable para vencimientos y lo identifica como pendiente de validación.
