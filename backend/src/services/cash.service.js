import { query, transaction } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './audit.service.js';

export async function getCashState(userId) {
  const result = await query(`SELECT cc.id_cierre AS "shiftId",cc.fecha_apertura AS "openedAt",
    cc.monto_inicial AS "initialAmount",c.id_caja AS "cashRegisterId",c.codigo AS code,c.descripcion AS description
    FROM cierre_caja cc JOIN caja c ON c.id_caja=cc.id_caja
    WHERE cc.id_usuario=$1 AND cc.estado='ABIERTA' ORDER BY cc.fecha_apertura DESC LIMIT 1`, [userId]);
  return result.rows[0] || null;
}

export async function openCash(input, actor) {
  return transaction(async (db) => {
    const existing = await db.query(`SELECT 1 FROM cierre_caja WHERE id_caja=$1 AND estado='ABIERTA' FOR UPDATE`, [input.cashRegisterId]);
    if (existing.rowCount) throw new AppError('La caja ya tiene un turno abierto.', 409, 'CASH_ALREADY_OPEN');
    const result = await db.query(`INSERT INTO cierre_caja(id_caja,id_usuario,monto_inicial)
      VALUES ($1,$2,$3) RETURNING id_cierre AS "shiftId",fecha_apertura AS "openedAt",
      monto_inicial AS "initialAmount",estado AS status`, [input.cashRegisterId, actor.userId, input.initialAmount]);
    await audit(db, { ...actor, action: 'APERTURA_CAJA', description: `Apertura de caja ${input.cashRegisterId} con S/ ${input.initialAmount}` });
    return result.rows[0];
  });
}

export async function getShiftSummary(shiftId, db = { query }) {
  const shift = await db.query(`SELECT cc.*,c.codigo,CONCAT(u.nombre,' ',u.apellido) AS cajero
    FROM cierre_caja cc JOIN caja c ON c.id_caja=cc.id_caja JOIN usuario u ON u.id_usuario=cc.id_usuario
    WHERE cc.id_cierre=$1`, [shiftId]);
  if (!shift.rowCount) throw new AppError('Turno de caja no encontrado.', 404, 'SHIFT_NOT_FOUND');
  const payments = await db.query(`SELECT p.metodo_pago AS method,COALESCE(SUM(p.monto),0) AS total
    FROM pago p JOIN venta v ON v.id_venta=p.id_venta
    WHERE v.id_caja=$1 AND v.id_usuario=$2 AND v.fecha_hora >= $3
      AND ($4::timestamp IS NULL OR v.fecha_hora <= $4) AND p.estado='APROBADO'
    GROUP BY p.metodo_pago`, [shift.rows[0].id_caja, shift.rows[0].id_usuario, shift.rows[0].fecha_apertura, shift.rows[0].fecha_cierre]);
  const byMethod = Object.fromEntries(payments.rows.map((row) => [row.method, Number(row.total)]));
  const initial = Number(shift.rows[0].monto_inicial);
  return {
    id: shift.rows[0].id_cierre,
    cashRegister: shift.rows[0].codigo,
    cashier: shift.rows[0].cajero,
    openedAt: shift.rows[0].fecha_apertura,
    closedAt: shift.rows[0].fecha_cierre,
    initialAmount: initial,
    payments: byMethod,
    expectedCash: initial + (byMethod.EFECTIVO || 0),
    countedCash: shift.rows[0].monto_final == null ? null : Number(shift.rows[0].monto_final),
    difference: shift.rows[0].diferencia == null ? null : Number(shift.rows[0].diferencia),
    observation: shift.rows[0].observacion,
    status: shift.rows[0].estado,
  };
}

export async function closeCash(input, actor) {
  return transaction(async (db) => {
    const opened = await db.query(`SELECT id_cierre FROM cierre_caja
      WHERE id_caja=$1 AND id_usuario=$2 AND estado='ABIERTA' FOR UPDATE`, [input.cashRegisterId, actor.userId]);
    if (!opened.rowCount) throw new AppError('No existe un turno abierto para este usuario y caja.', 409, 'CASH_NOT_OPEN');
    const summary = await getShiftSummary(opened.rows[0].id_cierre, db);
    const difference = Number(input.countedAmount) - summary.expectedCash;
    if (Math.abs(difference) >= 0.005 && !input.observation?.trim()) {
      throw new AppError('Registra una observación para la diferencia de caja.', 422, 'OBSERVATION_REQUIRED');
    }
    await db.query(`UPDATE cierre_caja SET fecha_cierre=NOW(),monto_esperado=$2,monto_final=$3,
      diferencia=$4,observacion=$5,estado='CERRADA' WHERE id_cierre=$1`,
    [opened.rows[0].id_cierre, summary.expectedCash, input.countedAmount, difference, input.observation || null]);
    await audit(db, { ...actor, action: 'CIERRE_CAJA', description: `Cierre ${opened.rows[0].id_cierre}; diferencia S/ ${difference.toFixed(2)}` });
    return getShiftSummary(opened.rows[0].id_cierre, db);
  });
}

export async function listClosures(filters) {
  const params = [];
  const where = [`cc.estado='CERRADA'`];
  if (filters.from) { params.push(filters.from); where.push(`cc.fecha_cierre >= $${params.length}`); }
  if (filters.to) { params.push(filters.to); where.push(`cc.fecha_cierre < ($${params.length}::date + INTERVAL '1 day')`); }
  const result = await query(`SELECT cc.id_cierre AS id,c.codigo AS "cashRegister",CONCAT(u.nombre,' ',u.apellido) AS cashier,
    cc.fecha_apertura AS "openedAt",cc.fecha_cierre AS "closedAt",cc.monto_inicial AS "initialAmount",
    cc.monto_esperado AS "expectedAmount",cc.monto_final AS "countedAmount",cc.diferencia AS difference,cc.observacion AS observation
    FROM cierre_caja cc JOIN caja c ON c.id_caja=cc.id_caja JOIN usuario u ON u.id_usuario=cc.id_usuario
    WHERE ${where.join(' AND ')} ORDER BY cc.fecha_cierre DESC LIMIT 200`, params);
  return result.rows;
}
