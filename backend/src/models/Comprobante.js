import { AppError } from '../utils/AppError.js';

export class Comprobante {
  constructor({ type, client }) {
    this.type = type;
    this.client = client;
  }
  validate() {
    if (!['BOLETA', 'FACTURA'].includes(this.type)) throw new AppError('Tipo de comprobante inválido.', 422, 'INVALID_RECEIPT_TYPE');
  }
}

export class Boleta extends Comprobante {
  validate() {
    super.validate();
    if (this.client?.dni && !/^\d{8}$/.test(this.client.dni)) throw new AppError('El DNI debe tener 8 dígitos.', 422, 'INVALID_DNI');
  }
}

export class Factura extends Comprobante {
  validate() {
    super.validate();
    if (!/^\d{11}$/.test(this.client?.ruc || '') || !this.client?.name?.trim()) {
      throw new AppError('La factura requiere RUC de 11 dígitos y razón social.', 422, 'INVALID_INVOICE_CLIENT');
    }
  }
}
