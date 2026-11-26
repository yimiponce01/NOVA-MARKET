# Arquitectura

## Capas

El proyecto conserva las tres capas del informe:

1. **Presentación:** React + Vite. Las páginas consumen JSON y nunca acceden directamente a PostgreSQL.
2. **Lógica de negocio:** Express, rutas, validadores, servicios y middleware de autorización.
3. **Persistencia:** repositorios/servicios SQL sobre `pg.Pool`, migraciones versionadas y transacciones.

## Flujo

```text
React → apiClient → API REST → autenticación/autorización → servicio → PostgreSQL
```

Las respuestas usan:

```json
{
  "success": true,
  "data": {},
  "message": "Operación realizada."
}
```

Los errores incluyen `success: false`, `message`, `code` y, para validación, `details`.

## Transacciones críticas

- Confirmar venta: bloquea venta e inventarios, valida pago, descuenta stock, crea movimientos, alertas y auditoría.
- Cerrar caja: calcula pagos aprobados por método, esperado, diferencia y auditoría.
- Crear/recepcionar orden: conserva detalles; la recepción incrementa inventario, movimientos y lotes.
- Emitir comprobante: bloquea correlativo, crea comprobante y actualiza la referencia compatible en venta.

## Seguridad

- Contraseñas: bcrypt, costo 12.
- Sesión: JWT con expiración y secreto externo.
- Roles validados en frontend para navegación y nuevamente en backend para seguridad.
- Helmet, CORS configurable, límite de JSON y rate limit de login.
- SQL parametrizado.
- Auditoría de operaciones críticas.
