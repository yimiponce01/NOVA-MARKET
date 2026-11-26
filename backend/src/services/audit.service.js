export async function audit(db, { userId, action, description, ip }) {
  await db.query(`INSERT INTO auditoria(id_usuario,accion,descripcion,ip)
    VALUES ($1,$2,$3,$4)`, [userId || null, action, description, ip || null]);
}
