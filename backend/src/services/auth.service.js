import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export class AuthService {
  constructor(userRepository) { this.userRepository = userRepository; }

  async login(login, password) {
    const user = await this.userRepository.findByLogin(login);
    if (!user || !(await bcrypt.compare(password, user.contrasena_hash))) {
      throw new AppError('Usuario o contraseña incorrectos.', 401, 'INVALID_CREDENTIALS');
    }
    if (user.estado !== 'ACTIVO') {
      throw new AppError('La cuenta no está activa.', 403, 'USER_INACTIVE');
    }
    const token = jwt.sign({ sub: user.id_usuario, role: user.rol, username: user.usuario }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    const { contrasena_hash: _hash, id_rol: _roleId, ...safeUser } = user;
    return { token, user: safeUser };
  }

  async me(id) {
    const user = await this.userRepository.findById(id);
    if (!user || user.estado !== 'ACTIVO') throw new AppError('Usuario no disponible.', 401, 'USER_UNAVAILABLE');
    return user;
  }
}
