import { IUserRepository } from '../interfaces/IUserRepository.js';

const demoUsers = [
  { id: 'u-1', name: 'Administradora Demo', email: 'admin@nova.test', password: 'NovaDemo123!', role: 'ADMIN' },
  { id: 'u-2', name: 'Carlos Cajero', email: 'cajero@nova.test', password: 'NovaDemo123!', role: 'CASHIER' },
  { id: 'u-3', name: 'Luis Almacén', email: 'almacen@nova.test', password: 'NovaDemo123!', role: 'WAREHOUSE' }
];

export class DemoUserRepository extends IUserRepository {
  async findByEmail(email) { return demoUsers.find(user => user.email.toLowerCase() === email.toLowerCase()) ?? null; }
  async findById(id) { return demoUsers.find(user => user.id === id) ?? null; }
}
