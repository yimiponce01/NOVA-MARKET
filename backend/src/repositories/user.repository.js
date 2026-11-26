import { query } from '../config/database.js';

export class UserRepository {
  async findByLogin(login) {
    const result = await query(`SELECT u.*, r.nombre AS rol
      FROM usuario u JOIN rol r ON r.id_rol=u.id_rol
      WHERE LOWER(u.correo)=LOWER($1) OR LOWER(u.usuario)=LOWER($1)
      LIMIT 1`, [login]);
    return result.rows[0] || null;
  }

  async findById(id) {
    const result = await query(`SELECT u.id_usuario,u.nombre,u.apellido,u.dni,u.correo,u.usuario,u.estado,r.nombre AS rol
      FROM usuario u JOIN rol r ON r.id_rol=u.id_rol WHERE u.id_usuario=$1`, [id]);
    return result.rows[0] || null;
  }
}
