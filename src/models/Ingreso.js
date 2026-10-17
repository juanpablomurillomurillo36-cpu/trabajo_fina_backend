/**
 * src/models/Ingreso.js
 * ---------------------------------------------------------------------
 * ENTIDAD Ingreso -> tabla `ingresos` (control de acceso al local).
 *
 * Cada registro es la prueba de que alguien escaneo un QR valido:
 * quien entro, cuando, por que puerta, con que dispositivo y quien lo
 * valido. `codigo_qr` es UNICO: el mismo QR jamas se dosifica dos
 * veces (RN-06 / control de aforo).
 */

const { ESTADO_INGRESO } = require('../utils/constants');

class Ingreso {
  #idIngreso;
  #idCliente;
  #idReserva;
  #codigoQr;
  #fecha;
  #hora;
  #puertaAcceso;
  #tipoDispositivo;
  #validadoPor;
  #estado;
  #nombreCliente;
  #nombreValidador;

  constructor(
    id = null,
    idCliente = null,
    idReserva = null,
    codigoQr = null,
    fecha = null,
    hora = null,
    puertaAcceso = null,
    tipoDispositivo = null,
    validadoPor = null,
    estado = ESTADO_INGRESO.VALIDO
  ) {
    this.#idIngreso = id;
    this.#idCliente = idCliente;
    this.#idReserva = idReserva;
    this.#codigoQr = codigoQr;
    this.#fecha = fecha;
    this.#hora = hora;
    this.#puertaAcceso = puertaAcceso;
    this.#tipoDispositivo = tipoDispositivo;
    this.#validadoPor = validadoPor;
    this.#estado = estado;
    this.#nombreCliente = null;
    this.#nombreValidador = null;
  }

  get id() {
    return this.#idIngreso;
  }

  get idCliente() {
    return this.#idCliente;
  }

  get idReserva() {
    return this.#idReserva;
  }

  get codigoQr() {
    return this.#codigoQr;
  }

  get fecha() {
    return this.#fecha;
  }

  get hora() {
    return this.#hora;
  }

  get puertaAcceso() {
    return this.#puertaAcceso;
  }

  get tipoDispositivo() {
    return this.#tipoDispositivo;
  }

  get validadoPor() {
    return this.#validadoPor;
  }

  get estado() {
    return this.#estado;
  }

  get nombreCliente() {
    return this.#nombreCliente;
  }

  get nombreValidador() {
    return this.#nombreValidador;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const ingreso = new Ingreso(
      fila.id_ingreso,
      fila.id_cliente,
      fila.id_reserva,
      fila.codigo_qr,
      fila.fecha,
      fila.hora,
      fila.puerta_acceso,
      fila.tipo_dispositivo,
      fila.validado_por,
      fila.estado
    );

    if (fila.nombre_cliente !== undefined) {
      ingreso.#nombreCliente = fila.nombre_cliente;
    }
    if (fila.nombre_validador !== undefined) {
      ingreso.#nombreValidador = fila.nombre_validador;
    }

    return ingreso;
  }

  /** Fila para INSERT (todo el dato ya fue validado por el service). */
  aFilaInsercion() {
    return {
      id_cliente: this.#idCliente,
      id_reserva: this.#idReserva,
      codigo_qr: this.#codigoQr,
      fecha: this.#fecha,
      hora: this.#hora,
      puerta_acceso: this.#puertaAcceso,
      tipo_dispositivo: this.#tipoDispositivo,
      validado_por: this.#validadoPor,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idIngreso,
      idCliente: this.#idCliente,
      nombreCliente: this.#nombreCliente,
      idReserva: this.#idReserva,
      codigoQr: this.#codigoQr,
      fecha: this.#fecha,
      hora: this.#hora,
      puertaAcceso: this.#puertaAcceso,
      tipoDispositivo: this.#tipoDispositivo,
      validadoPor: this.#validadoPor,
      nombreValidador: this.#nombreValidador,
      estado: this.#estado
    };
  }
}

module.exports = Ingreso;
