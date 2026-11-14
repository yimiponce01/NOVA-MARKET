export class AuthService {
  constructor(userRepository) { this.userRepository = userRepository; }

  async login(email, password) {
    const user = await this.userRepository.findByEmail(email);
    if (!user || user.password !== password) {
      const error = new Error('Correo o contraseña incorrectos.');
      error.status = 401;
      throw error;
    }
    // Token de demostración no criptográfico. Reemplazar por sesiones/JWT seguros en producción.
    const token = `demo-${user.id}-${Date.now()}`;
    const { password: _password, ...safeUser } = user;
    return { token, user: safeUser };
  }
}
