import bcrypt from 'bcryptjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { query, transaction } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './audit.service.js';

export async function listUsers() {
  const result = await query(`SELECT u.id_usuario AS id,u.nombre AS name,u.apellido AS surname,u.dni,u.correo AS email,
    u.usuario AS username,u.estado AS status,r.nombre AS role,r.id_rol AS "roleId"
    FROM usuario u JOIN rol r ON r.id_rol=u.id_rol ORDER BY u.nombre,u.apellido`);
  return result.rows;
}

export async function listRoles() {
  return (await query(`SELECT id_rol AS id,nombre AS name,descripcion AS description,estado AS status FROM rol ORDER BY id_rol`)).rows;
}

export async function createUser(input, actor) {
  const hash = await bcrypt.hash(input.password, 12);
  try {
    const result = await query(`INSERT INTO usuario(id_rol,nombre,apellido,dni,correo,usuario,contrasena_hash,estado)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id_usuario AS id,nombre AS name,apellido AS surname,dni,correo AS email,usuario AS username,estado AS status`,
    [input.roleId, input.name, input.surname, input.dni || null, input.email || null, input.username, hash, input.active === false ? 'INACTIVO' : 'ACTIVO']);
    await audit({ query }, { ...actor, action: 'USUARIO_CREADO', description: `Usuario ${input.username} creado` });
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') throw new AppError('Usuario, correo o DNI ya registrado.', 409, 'DUPLICATE_USER');
    throw error;
  }
}

export async function updateUser(id, input, actor) {
  const hash = input.password ? await bcrypt.hash(input.password, 12) : null;
  const result = await query(`UPDATE usuario SET id_rol=COALESCE($2,id_rol),nombre=COALESCE($3,nombre),
    apellido=COALESCE($4,apellido),dni=COALESCE($5,dni),correo=COALESCE($6,correo),
    usuario=COALESCE($7,usuario),contrasena_hash=COALESCE($8,contrasena_hash),
    estado=COALESCE($9,estado) WHERE id_usuario=$1
    RETURNING id_usuario AS id,nombre AS name,apellido AS surname,dni,correo AS email,usuario AS username,estado AS status`,
  [id, input.roleId, input.name, input.surname, input.dni, input.email, input.username, hash, input.active == null ? null : input.active ? 'ACTIVO' : 'INACTIVO']);
  if (!result.rowCount) throw new AppError('Usuario no encontrado.', 404, 'USER_NOT_FOUND');
  await audit({ query }, { ...actor, action: 'USUARIO_ACTUALIZADO', description: `Usuario ${id} actualizado` });
  return result.rows[0];
}

export async function getConfiguration() {
  const result = await query('SELECT clave AS key,valor AS value,descripcion AS description FROM configuracion ORDER BY clave');
  return Object.fromEntries(result.rows.map((row) => [row.key, { value: row.value, description: row.description }]));
}

const editableConfig = new Set(['IGV', 'SERIE_BOLETA', 'SERIE_FACTURA', 'DIAS_ALERTA_VENCIMIENTO', 'NOMBRE_NEGOCIO', 'RUC_NEGOCIO', 'DIRECCION_NEGOCIO']);
export async function updateConfiguration(values, actor) {
  return transaction(async (db) => {
    for (const [key, value] of Object.entries(values)) {
      if (!editableConfig.has(key)) throw new AppError(`Configuración no editable: ${key}`, 422, 'CONFIG_NOT_EDITABLE');
      await db.query(`INSERT INTO configuracion(clave,valor) VALUES ($1,$2)
        ON CONFLICT(clave) DO UPDATE SET valor=EXCLUDED.valor`, [key, String(value)]);
    }
    await audit(db, { ...actor, action: 'CONFIGURACION_ACTUALIZADA', description: `Parámetros actualizados: ${Object.keys(values).join(', ')}` });
    const result = await db.query('SELECT clave AS key,valor AS value,descripcion AS description FROM configuracion ORDER BY clave');
    return Object.fromEntries(result.rows.map((row) => [row.key, { value: row.value, description: row.description }]));
  });
}

export async function listAudit(filters) {
  const params = [];
  const where = ['1=1'];
  if (filters.userId) { params.push(filters.userId); where.push(`a.id_usuario=$${params.length}`); }
  if (filters.action) { params.push(filters.action); where.push(`a.accion=$${params.length}`); }
  if (filters.from) { params.push(filters.from); where.push(`a.fecha_hora >= $${params.length}`); }
  if (filters.to) { params.push(filters.to); where.push(`a.fecha_hora < ($${params.length}::date + INTERVAL '1 day')`); }
  const result = await query(`SELECT a.id_auditoria AS id,a.accion AS action,a.fecha_hora AS date,
    a.descripcion AS description,a.ip,COALESCE(u.usuario,'sistema') AS username
    FROM auditoria a LEFT JOIN usuario u ON u.id_usuario=a.id_usuario
    WHERE ${where.join(' AND ')} ORDER BY a.fecha_hora DESC LIMIT 500`, params);
  return result.rows;
}

export async function report(type, filters, userId) {
  let rows;
  if (type === 'ventas') {
    const params = [];
    const salesWhere = [`v.estado='PAGADA'`];
    if (filters.from) {
      params.push(filters.from);
      salesWhere.push(`v.fecha_hora >= $${params.length}::date`);
    }
    if (filters.to) {
      params.push(filters.to);
      salesWhere.push(`v.fecha_hora < ($${params.length}::date + INTERVAL '1 day')`);
    }
    rows = (await query(`WITH ventas_dia AS (
        SELECT v.fecha_hora::date AS date,COUNT(*)::int AS transactions,SUM(v.total) AS total
        FROM venta v WHERE ${salesWhere.join(' AND ')}
        GROUP BY v.fecha_hora::date
      ), unidades_dia AS (
        SELECT v.fecha_hora::date AS date,SUM(d.cantidad)::int AS units
        FROM venta v JOIN detalle_venta d ON d.id_venta=v.id_venta
        WHERE ${salesWhere.join(' AND ')}
        GROUP BY v.fecha_hora::date
      )
      SELECT vd.date,vd.transactions,COALESCE(ud.units,0) AS units,vd.total
      FROM ventas_dia vd LEFT JOIN unidades_dia ud ON ud.date=vd.date ORDER BY vd.date`,
    params)).rows;
  } else if (type === 'productos') {
    rows = (await query(`SELECT p.id_producto AS id,p.nombre AS product,
      COALESCE(SUM(CASE WHEN v.estado='PAGADA' THEN d.cantidad ELSE 0 END),0)::int AS units,
      COALESCE(SUM(CASE WHEN v.estado='PAGADA' THEN d.subtotal ELSE 0 END),0) AS total
      FROM producto p LEFT JOIN detalle_venta d ON d.id_producto=p.id_producto
      LEFT JOIN venta v ON v.id_venta=d.id_venta AND v.estado='PAGADA'
      GROUP BY p.id_producto ORDER BY units DESC`)).rows;
  } else if (type === 'inventario') {
    rows = (await query(`SELECT p.nombre AS product,c.nombre AS category,i.stock_actual AS stock,
      i.stock_minimo AS "minimumStock",p.precio_venta AS price,(i.stock_actual*p.precio_venta) AS value
      FROM inventario i JOIN producto p ON p.id_producto=i.id_producto JOIN categoria c ON c.id_categoria=p.id_categoria
      ORDER BY p.nombre`)).rows;
  } else if (type === 'caja') {
    const params = [];
    const where = ['1=1'];
    if (filters.from) { params.push(filters.from); where.push(`cc.fecha_apertura >= $${params.length}::date`); }
    if (filters.to) { params.push(filters.to); where.push(`cc.fecha_apertura < ($${params.length}::date + INTERVAL '1 day')`); }
    rows = (await query(`SELECT cc.id_cierre AS id,c.codigo AS "cashRegister",u.usuario AS cashier,
      cc.fecha_apertura AS "openedAt",cc.fecha_cierre AS "closedAt",cc.monto_inicial AS "initialAmount",
      cc.monto_esperado AS "expectedAmount",cc.monto_final AS "countedAmount",cc.diferencia,
      COALESCE(pagos.efectivo,0) AS "cashPayments",COALESCE(pagos.tarjeta,0) AS "cardPayments",
      COALESCE(pagos.yape,0) AS "yapePayments",COALESCE(pagos.plin,0) AS "plinPayments"
      FROM cierre_caja cc JOIN caja c ON c.id_caja=cc.id_caja JOIN usuario u ON u.id_usuario=cc.id_usuario
      LEFT JOIN (
        SELECT cc2.id_cierre,
          SUM(CASE WHEN p.metodo_pago='EFECTIVO' THEN p.monto ELSE 0 END) AS efectivo,
          SUM(CASE WHEN p.metodo_pago='TARJETA' THEN p.monto ELSE 0 END) AS tarjeta,
          SUM(CASE WHEN p.metodo_pago='YAPE' THEN p.monto ELSE 0 END) AS yape,
          SUM(CASE WHEN p.metodo_pago='PLIN' THEN p.monto ELSE 0 END) AS plin
        FROM cierre_caja cc2
        JOIN venta v ON v.id_caja=cc2.id_caja AND v.id_usuario=cc2.id_usuario
          AND v.fecha_hora >= cc2.fecha_apertura AND (cc2.fecha_cierre IS NULL OR v.fecha_hora <= cc2.fecha_cierre)
          AND v.estado='PAGADA'
        JOIN pago p ON p.id_venta=v.id_venta AND p.estado='APROBADO'
        GROUP BY cc2.id_cierre
      ) pagos ON pagos.id_cierre=cc.id_cierre
      WHERE ${where.join(' AND ')} ORDER BY cc.fecha_apertura DESC`, params)).rows;
  } else throw new AppError('Tipo de reporte no válido.', 404, 'REPORT_NOT_FOUND');
  await query(`INSERT INTO reporte(id_usuario,nombre,tipo,descripcion) VALUES ($1,$2,$3,$4)`,
    [userId, `Reporte de ${type}`, type.toUpperCase(), `Registros generados: ${rows.length}`]);
  return { type, generatedAt: new Date().toISOString(), rows };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], ...options });
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk; });
    child.on('error', () => reject(new AppError(`${command} no está disponible.`, 503, 'INTEGRATION_NOT_CONFIGURED')));
    child.on('close', (code) => code === 0 ? resolve() : reject(new AppError(error || `${command} falló.`, 500, 'BACKUP_FAILED')));
  });
}

export async function listBackups() {
  return (await query(`SELECT id_respaldo AS id,fecha_hora AS date,ubicacion AS location,tamanio_mb AS "sizeMb",
    tipo AS type,estado AS status FROM respaldo ORDER BY fecha_hora DESC`)).rows;
}

function postgresCliOptions() {
  const connection = new URL(env.databaseUrl);
  const password = decodeURIComponent(connection.password);
  return {
    args: [
      '--host', connection.hostname,
      '--port', connection.port || '5432',
      '--username', decodeURIComponent(connection.username),
      '--dbname', decodeURIComponent(connection.pathname.slice(1)),
    ],
    options: { env: { ...process.env, PGPASSWORD: password } },
  };
}

export async function createBackup(actor) {
  if (!env.backupDir || !env.databaseUrl) throw new AppError('El respaldo no está configurado.', 503, 'INTEGRATION_NOT_CONFIGURED');
  await fs.mkdir(env.backupDir, { recursive: true });
  const filename = `nova-market-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
  const location = path.join(env.backupDir, filename);
  const connection = postgresCliOptions();
  await run('pg_dump', ['--format=custom', '--file', location, ...connection.args], connection.options);
  const stat = await fs.stat(location);
  const result = await query(`INSERT INTO respaldo(id_usuario,ubicacion,tamanio_mb,tipo,estado)
    VALUES ($1,$2,$3,'MANUAL','COMPLETADO') RETURNING id_respaldo AS id,fecha_hora AS date,ubicacion AS location,tamanio_mb AS "sizeMb",estado AS status`,
  [actor.userId, location, stat.size / 1024 / 1024]);
  await audit({ query }, { ...actor, action: 'RESPALDO_GENERADO', description: `Respaldo ${filename} generado` });
  return result.rows[0];
}

export async function restoreBackup(id, confirmation, actor) {
  if (confirmation !== 'RESTAURAR') throw new AppError('Confirmación de restauración inválida.', 422, 'CONFIRMATION_REQUIRED');
  if (!env.backupDir || !env.databaseUrl) throw new AppError('La restauración no está configurada.', 503, 'INTEGRATION_NOT_CONFIGURED');
  const backup = await query('SELECT * FROM respaldo WHERE id_respaldo=$1 AND estado=$2', [id, 'COMPLETADO']);
  if (!backup.rowCount) throw new AppError('Respaldo no encontrado.', 404, 'BACKUP_NOT_FOUND');
  const connection = postgresCliOptions();
  await run('pg_restore', ['--clean', '--if-exists', '--no-owner', ...connection.args, backup.rows[0].ubicacion], connection.options);
  await audit({ query }, { ...actor, action: 'RESPALDO_RESTAURADO', description: `Respaldo ${id} restaurado` });
  return { id, status: 'RESTAURADO' };
}

export async function dashboardSummary() {
  const [sales, boxes, alerts, hours, recent] = await Promise.all([
    query(`SELECT COUNT(*)::int AS transactions,COALESCE(SUM(total),0) AS total FROM venta WHERE estado='PAGADA' AND fecha_hora::date=CURRENT_DATE`),
    query(`SELECT COUNT(*)::int AS open FROM cierre_caja WHERE estado='ABIERTA'`),
    query(`SELECT COUNT(*)::int AS total FROM alerta_stock WHERE estado='PENDIENTE'`),
    query(`SELECT EXTRACT(HOUR FROM fecha_hora)::int AS hour,COALESCE(SUM(total),0) AS total
      FROM venta WHERE estado='PAGADA' AND fecha_hora::date=CURRENT_DATE GROUP BY hour ORDER BY hour`),
    query(`SELECT accion AS action,descripcion AS description,fecha_hora AS date FROM auditoria ORDER BY fecha_hora DESC LIMIT 6`),
  ]);
  return {
    salesToday: Number(sales.rows[0].total), transactions: sales.rows[0].transactions,
    openCashRegisters: boxes.rows[0].open, activeAlerts: alerts.rows[0].total,
    salesByHour: hours.rows.map((row) => ({ hour: row.hour, total: Number(row.total) })),
    recentActivity: recent.rows,
  };
}
