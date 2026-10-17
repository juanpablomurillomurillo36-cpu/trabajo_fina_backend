/**
 * src/models/DetalleReserva.js
 * ---------------------------------------------------------------------
 * ENTIDAD DetalleReserva -> tabla `detalle_reserva` (hija de Reserva,
 * COMPOSICION P4).
 *
 * `subtotal` es columna GENERADA por MySQL (cantidad * precio_unitario):
 * JAMAS se inserta ni se actualiza; aqui se calcula en memoria con la
 * misma formula. El precio SIEMPRE viene del catalogo de servicios,
 * nunca del body del cliente.
 */

class DetalleReserva {
  #idDetalleReserva;
  #idReserva;
  #idServicio;
  #cantidad;
  #precioUnitario;
  #subtotal;
  #nombreServicio;

  constructor(
    id = null,
    idReserva = null,
    idServicio = null,
    cantidad = 1,
    precioUnitario = 0,
    subtotal = null
  ) {
    this.#idDetalleReserva = id;
    this.#idReserva = idReserva;
    this.#idServicio = idServicio;
    this.#cantidad = cantidad;
    this.#precioUnitario = precioUnitario;
    this.#subtotal = subtotal;
    this.#nombreServicio = null;
  }

  get id() {
    return this.#idDetalleReserva;
  }

  get idReserva() {
    return this.#idReserva;
  }

  set idReserva(valor) {
    this.#idReserva = valor;
  }

  get idServicio() {
    return this.#idServicio;
  }

  set idServicio(valor) {
    this.#idServicio = valor;
  }

  get cantidad() {
    return this.#cantidad;
  }

  set cantidad(valor) {
    const numero = Math.trunc(Number(valor));
    this.#cantidad = Number.isFinite(numero) && numero > 0 ? numero : 1;
  }

  get precioUnitario() {
    return this.#precioUnitario;
  }

  set precioUnitario(valor) {
    const numero = Number(valor);
    this.#precioUnitario = Number.isFinite(numero) && numero >= 0 ? numero : 0;
  }

  /** Igual formula que la columna generada de MySQL. */
  get subtotal() {
    return this.#subtotal ?? this.#cantidad * this.#precioUnitario;
  }

  get nombreServicio() {
    return this.#nombreServicio;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const detalle = new DetalleReserva(
      fila.id_detalle_reserva,
      fila.id_reserva,
      fila.id_servicio,
      fila.cantidad,
      fila.precio_unitario,
      fila.subtotal
    );

    if (fila.nombre_servicio !== undefined) {
      detalle.#nombreServicio = fila.nombre_servicio;
    }

    return detalle;
  }

  /** Linea cruda del body: solo idServicio y cantidad (el precio no). */
  static desdeJSON(datos = {}) {
    return new DetalleReserva(
      null,
      null,
      datos.idServicio ?? datos.id_servicio ?? null,
      datos.cantidad ?? 1,
      0
    );
  }

  /** Fila para INSERT (NUNCA incluye subtotal: es columna generada). */
  aFilaInsercion(idReserva) {
    return {
      id_reserva: idReserva,
      id_servicio: this.#idServicio,
      cantidad: this.#cantidad,
      precio_unitario: this.#precioUnitario
    };
  }

  toJSON() {
    return {
      id: this.#idDetalleReserva,
      idReserva: this.#idReserva,
      idServicio: this.#idServicio,
      nombreServicio: this.#nombreServicio,
      cantidad: this.#cantidad,
      precioUnitario: this.#precioUnitario,
      subtotal: this.subtotal
    };
  }
}

module.exports = DetalleReserva;
