/**
 * src/models/Reserva.js
 * ---------------------------------------------------------------------
 * ENTIDAD Reserva -> tabla `reservas` (composicion P4 con
 * `detalle_reserva`).
 *
 * `subtotal` y `descuento` se CALCULAN en el service (RN-04): el
 * cliente nunca los impone. `#nombreCliente` viene del JOIN (lectura)
 * y `#detalles` lo inyecta ReservaRepository.obtenerConDetalles.
 */

const { ESTADO_RESERVA } = require('../utils/constants');

class Reserva {
  #idReserva;
  #idCliente;
  #tipoEspacio;
  #identificadorEspacio;
  #fecha;
  #hora;
  #descuento;
  #subtotal;
  #estado;
  #nombreCliente;
  #detalles;

  constructor(
    id = null,
    idCliente = null,
    tipoEspacio = null,
    identificadorEspacio = null,
    fecha = null,
    hora = null,
    descuento = 0,
    subtotal = 0,
    estado = ESTADO_RESERVA.PENDIENTE
  ) {
    this.#idReserva = id;
    this.#idCliente = idCliente;
    this.#tipoEspacio = tipoEspacio;
    this.#identificadorEspacio = identificadorEspacio;
    this.#fecha = fecha;
    this.#hora = hora;
    this.#descuento = descuento;
    this.#subtotal = subtotal;
    this.#estado = estado;
    this.#nombreCliente = null;
    this.#detalles = null;
  }

  get id() {
    return this.#idReserva;
  }

  get idCliente() {
    return this.#idCliente;
  }

  set idCliente(valor) {
    this.#idCliente = valor;
  }

  get tipoEspacio() {
    return this.#tipoEspacio;
  }

  set tipoEspacio(valor) {
    this.#tipoEspacio = valor;
  }

  get identificadorEspacio() {
    return this.#identificadorEspacio;
  }

  set identificadorEspacio(valor) {
    this.#identificadorEspacio = valor;
  }

  get fecha() {
    return this.#fecha;
  }

  set fecha(valor) {
    this.#fecha = valor;
  }

  get hora() {
    return this.#hora;
  }

  set hora(valor) {
    this.#hora = valor;
  }

  get descuento() {
    return this.#descuento;
  }

  set descuento(valor) {
    this.#descuento = valor;
  }

  get subtotal() {
    return this.#subtotal;
  }

  set subtotal(valor) {
    this.#subtotal = valor;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  /** Truquito legible para services/controllers (igual que Compra). */
  get pendiente() {
    return this.#estado === ESTADO_RESERVA.PENDIENTE;
  }

  /** Total a pagar: subtotal menos el descuento aplicado (RN-04). */
  get total() {
    return this.#subtotal - this.#descuento;
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

  /**
   * Recalcula subtotal y descuento a partir de las lineas cargadas.
   * La fuente unica del calculo es el server (el body no manda).
   *
   * @param {number} porcentajeDescuento
   * @param {number} minimoServicios
   */
  recalcular(porcentajeDescuento, minimoServicios) {
    if (this.#detalles === null) return;

    this.#subtotal = this.#detalles.reduce((suma, d) => suma + d.subtotal, 0);
    this.#descuento =
      this.#detalles.length >= minimoServicios
        ? Number((this.#subtotal * (porcentajeDescuento / 100)).toFixed(2))
        : 0;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const reserva = new Reserva(
      fila.id_reserva,
      fila.id_cliente,
      fila.tipo_espacio,
      fila.identificador_espacio,
      fila.fecha,
      fila.hora,
      fila.descuento,
      fila.subtotal,
      fila.estado
    );

    if (fila.nombre_cliente !== undefined) {
      reserva.#nombreCliente = fila.nombre_cliente;
    }

    return reserva;
  }

  static desdeJSON(datos = {}) {
    return new Reserva(
      datos.id ?? null,
      datos.idCliente ?? null,
      datos.tipoEspacio ?? null,
      datos.identificadorEspacio ?? null,
      datos.fecha ?? null,
      datos.hora ?? null,
      datos.descuento ?? 0,
      datos.subtotal ?? 0,
      datos.estado ?? ESTADO_RESERVA.PENDIENTE
    );
  }

  aFilaBaseDatos() {
    return {
      id_cliente: this.#idCliente,
      tipo_espacio: this.#tipoEspacio,
      identificador_espacio: this.#identificadorEspacio,
      fecha: this.#fecha,
      hora: this.#hora,
      descuento: this.#descuento,
      subtotal: this.#subtotal,
      estado: this.#estado
    };
  }

  toJSON() {
    const json = {
      id: this.#idReserva,
      idCliente: this.#idCliente,
      nombreCliente: this.#nombreCliente,
      tipoEspacio: this.#tipoEspacio,
      identificadorEspacio: this.#identificadorEspacio,
      fecha: this.#fecha,
      hora: this.#hora,
      descuento: this.#descuento,
      subtotal: this.#subtotal,
      total: this.total,
      estado: this.#estado
    };

    if (this.#detalles !== null) {
      json.detalles = this.#detalles.map((d) => d.toJSON());
    }

    return json;
  }
}

module.exports = Reserva;
