CREATE TABLE IF NOT EXISTS rol (
  id_rol SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(150),
  estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario SERIAL PRIMARY KEY,
  id_rol INT NOT NULL REFERENCES rol(id_rol),
  nombre VARCHAR(60) NOT NULL,
  apellido VARCHAR(60) NOT NULL,
  dni CHAR(8) UNIQUE,
  correo VARCHAR(100) UNIQUE,
  usuario VARCHAR(30) NOT NULL UNIQUE,
  contrasena_hash VARCHAR(255) NOT NULL,
  estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO'
    CHECK (estado IN ('ACTIVO','INACTIVO','BLOQUEADO'))
);

CREATE TABLE IF NOT EXISTS cliente (
  id_cliente SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(60),
  dni CHAR(8) UNIQUE,
  ruc CHAR(11) UNIQUE,
  direccion VARCHAR(150),
  telefono VARCHAR(15),
  correo VARCHAR(100),
  tipo_cliente VARCHAR(20),
  estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS categoria (
  id_categoria SERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  descripcion VARCHAR(150),
  estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS producto (
  id_producto SERIAL PRIMARY KEY,
  id_categoria INT NOT NULL REFERENCES categoria(id_categoria),
  codigo_barra VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255),
  precio_venta NUMERIC(10,2) NOT NULL CHECK (precio_venta > 0),
  stock_minimo INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO'
);
CREATE INDEX IF NOT EXISTS idx_producto_nombre ON producto(nombre);

CREATE TABLE IF NOT EXISTS inventario (
  id_inventario SERIAL PRIMARY KEY,
  id_producto INT NOT NULL UNIQUE REFERENCES producto(id_producto),
  stock_actual INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  stock_maximo INT,
  ubicacion VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS movimiento_inventario (
  id_movimiento BIGSERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES producto(id_producto),
  id_usuario INT REFERENCES usuario(id_usuario),
  tipo_movimiento VARCHAR(20) NOT NULL
    CHECK (tipo_movimiento IN ('INGRESO','SALIDA_VENTA','AJUSTE')),
  cantidad INT NOT NULL CHECK (cantidad > 0),
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  motivo VARCHAR(150),
  referencia VARCHAR(50),
  estado VARCHAR(15) NOT NULL DEFAULT 'REGISTRADO'
);
CREATE INDEX IF NOT EXISTS idx_mov_producto_fecha ON movimiento_inventario(id_producto, fecha);

CREATE TABLE IF NOT EXISTS alerta_stock (
  id_alerta SERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES producto(id_producto),
  tipo_alerta VARCHAR(20) NOT NULL
    CHECK (tipo_alerta IN ('STOCK_MINIMO','AGOTADO','PROXIMO_VENCER')),
  stock_actual INT,
  stock_minimo INT,
  fecha_generacion TIMESTAMP NOT NULL DEFAULT NOW(),
  estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE','ATENDIDA'))
);
CREATE INDEX IF NOT EXISTS idx_alerta_estado ON alerta_stock(estado);

CREATE TABLE IF NOT EXISTS proveedor (
  id_proveedor SERIAL PRIMARY KEY,
  ruc CHAR(11) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  direccion VARCHAR(150),
  telefono VARCHAR(15),
  correo VARCHAR(100),
  estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS orden_compra (
  id_orden SERIAL PRIMARY KEY,
  id_proveedor INT NOT NULL REFERENCES proveedor(id_proveedor),
  id_usuario INT REFERENCES usuario(id_usuario),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE','APROBADA','ENVIADA','RECIBIDA','ANULADA')),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  observacion VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS detalle_orden_compra (
  id_detalle SERIAL PRIMARY KEY,
  id_orden INT NOT NULL REFERENCES orden_compra(id_orden) ON DELETE CASCADE,
  id_producto INT NOT NULL REFERENCES producto(id_producto),
  cantidad INT NOT NULL CHECK (cantidad > 0),
  cantidad_recibida INT NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
  precio_compra NUMERIC(10,2) NOT NULL CHECK (precio_compra > 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal > 0)
);

CREATE TABLE IF NOT EXISTS lote (
  id_lote SERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES producto(id_producto),
  id_orden INT REFERENCES orden_compra(id_orden),
  numero_lote VARCHAR(30) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  cantidad INT NOT NULL CHECK (cantidad > 0),
  fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  estado VARCHAR(15) NOT NULL DEFAULT 'VIGENTE',
  UNIQUE (id_producto, numero_lote)
);

CREATE TABLE IF NOT EXISTS caja (
  id_caja SERIAL PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE,
  descripcion VARCHAR(100),
  estado VARCHAR(15) NOT NULL DEFAULT 'DISPONIBLE'
);

CREATE TABLE IF NOT EXISTS cierre_caja (
  id_cierre SERIAL PRIMARY KEY,
  id_caja INT NOT NULL REFERENCES caja(id_caja),
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  fecha_apertura TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_cierre TIMESTAMP,
  monto_inicial NUMERIC(10,2) NOT NULL CHECK (monto_inicial >= 0),
  monto_esperado NUMERIC(10,2),
  monto_final NUMERIC(10,2),
  diferencia NUMERIC(10,2),
  observacion VARCHAR(255),
  estado VARCHAR(15) NOT NULL DEFAULT 'ABIERTA'
    CHECK (estado IN ('ABIERTA','CERRADA'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_abierto ON cierre_caja(id_caja) WHERE estado = 'ABIERTA';

CREATE TABLE IF NOT EXISTS venta (
  id_venta BIGSERIAL PRIMARY KEY,
  id_cliente INT REFERENCES cliente(id_cliente),
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  id_caja INT NOT NULL REFERENCES caja(id_caja),
  fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
  tipo_comprobante VARCHAR(10),
  serie CHAR(4),
  numero VARCHAR(8),
  total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estado VARCHAR(15) NOT NULL DEFAULT 'EN_PROCESO'
    CHECK (estado IN ('EN_PROCESO','PAGADA','ANULADA'))
);
CREATE INDEX IF NOT EXISTS idx_venta_caja_fecha ON venta(id_caja, fecha_hora);

CREATE TABLE IF NOT EXISTS detalle_venta (
  id_detalle BIGSERIAL PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
  id_producto INT NOT NULL REFERENCES producto(id_producto),
  cantidad INT NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario > 0),
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal > 0),
  UNIQUE (id_venta, id_producto)
);
CREATE INDEX IF NOT EXISTS idx_detalle_producto ON detalle_venta(id_producto);

CREATE TABLE IF NOT EXISTS pago (
  id_pago BIGSERIAL PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
  fecha_pago TIMESTAMP NOT NULL DEFAULT NOW(),
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  monto_recibido NUMERIC(10,2),
  metodo_pago VARCHAR(15) NOT NULL
    CHECK (metodo_pago IN ('EFECTIVO','TARJETA','YAPE','PLIN')),
  estado VARCHAR(15) NOT NULL DEFAULT 'APROBADO'
    CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO')),
  referencia VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS comprobante (
  id_comprobante BIGSERIAL PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES venta(id_venta),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('BOLETA','FACTURA')),
  serie CHAR(4) NOT NULL,
  numero VARCHAR(8) NOT NULL,
  fecha_emision TIMESTAMP NOT NULL DEFAULT NOW(),
  monto_total NUMERIC(10,2) NOT NULL,
  estado VARCHAR(15) NOT NULL DEFAULT 'GENERADO'
    CHECK (estado IN ('GENERADO','ENVIADO','ACEPTADO','RECHAZADO')),
  UNIQUE (tipo, serie, numero)
);

CREATE TABLE IF NOT EXISTS reporte (
  id_reporte SERIAL PRIMARY KEY,
  id_usuario INT REFERENCES usuario(id_usuario),
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  fecha_generacion TIMESTAMP NOT NULL DEFAULT NOW(),
  descripcion VARCHAR(255),
  estado VARCHAR(15) NOT NULL DEFAULT 'GENERADO'
);

CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria BIGSERIAL PRIMARY KEY,
  id_usuario INT REFERENCES usuario(id_usuario),
  accion VARCHAR(60) NOT NULL,
  fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
  descripcion VARCHAR(255),
  ip VARCHAR(45),
  estado VARCHAR(15) NOT NULL DEFAULT 'REGISTRADO'
);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha_hora);

CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(50) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL,
  descripcion VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS respaldo (
  id_respaldo SERIAL PRIMARY KEY,
  id_usuario INT REFERENCES usuario(id_usuario),
  fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
  ubicacion VARCHAR(255) NOT NULL,
  tamanio_mb NUMERIC(10,2),
  tipo VARCHAR(15) NOT NULL DEFAULT 'MANUAL',
  estado VARCHAR(15) NOT NULL
);
