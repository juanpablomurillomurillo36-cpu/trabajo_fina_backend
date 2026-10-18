/**
 * src/models/Venta.js
 * ---------------------------------------------------------------------
 * ENTIDAD Venta -> tabla `ventas` (composicion P4 con
 * `detalle_ventas`).
 *
 * `total` nace como la SUMA de las lineas (base sin IVA); el IVA y el
 * comprobante se generan al PAGAR (fase 42, RN-10). `fecha_venta` es
 * DEFAULT CURRENT_TIMESTAMP: no se pone en el INSERT.
 */

const { ESTADO_VENTA, METODO_PAGO } = require('../utils/constants');

class Venta {
  #idVenta;
  #idCliente;
  #fechaVenta;
  #total;
  #metodoPago;
  #comprobanteNo;
  #estado;
  #nombreCliente;
  #detalles;

  constructor(
    id = null,
    idCliente = null,
    fechaVenta = null,
    total = 0,
    metodoPago = METODO_PAGO.EFECTIVO,
    comprobanteNo = null,
    estado = ESTADO_VENTA.PENDIENTE
  ) {
    this.#idVenta = id;
    this.#idCliente = idCliente;
    this.#fechaVenta = fechaVenta;
    this.#total = total;
    this.#metodoPago = metodoPago;
    this.#comprobanteNo = comprobanteNo;
    this.#estado = estado;
    this.#nombreCliente = null;
    this.#detalles = null;
  }

  get id() {
    return this.#idVenta;
  }

  get idCliente() {
    return this.#idCliente;
  }

  set idCliente(valor) {
    this.#idCliente = valor;
  }

  get fechaVenta() {
    return this.#fechaVenta;
  }

  get total() {
    return this.#total;
  }

  set total(valor) {
    this.#total = valor;
  }

  get metodoPago() {
    return this.#metodoPago;
  }

  set metodoPago(valor) {
    this.#metodoPago = valor;
  }

  get comprobanteNo() {
    return this.#comprobanteNo;
  }

  set comprobanteNo(valor) {
    this.#comprobanteNo = valor;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  /** Truquito legible (igual que Compra/Reserva). */
  get pendiente() {
    return this.#estado === ESTADO_VENTA.PENDIENTE;
  }

  get nombreCliente() {
    return this.#nombreCliente;
  }

  get detalles() {
    return this.#detalles ?? [];
  }

  set detalles(lista) {
    this.#detalles = lista;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const venta = new Venta(
      fila.id_venta,
      fila.id_cliente,
      fila.fecha_venta,
      fila.total,
      fila.metodo_pago,
      fila.comprobante_no,
      fila.estado
    );

    if (fila.nombre_cliente !== undefined) {
      venta.#nombreCliente = fila.nombre_cliente;
    }

    return venta;
  }

  aFilaBaseDatos() {
    return {
      id_cliente: this.#idCliente,
      total: this.#total,
      metodo_pago: this.#metodoPago,
      comprobante_no: this.#comprobanteNo,
      estado: this.#estado
    };
  }

  toJSON() {
    const json = {
      id: this.#idVenta,
      idCliente: this.#idCliente,
      nombreCliente: this.#nombreCliente,
      fechaVenta: this.#fechaVenta,
      total: this.#total,
      metodoPago: this.#metodoPago,
      comprobanteNo: this.#comprobanteNo,
      estado: this.#estado,
      pendiente: this.pendiente
    };

    if (this.#detalles !== null) {
      json.detalles = this.#detalles.map((d) => d.toJSON());
    }

    return json;
  }
}

module.exports = Venta;
