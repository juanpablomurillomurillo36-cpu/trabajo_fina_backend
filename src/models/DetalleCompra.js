/**
 * src/models/DetalleCompra.js
 * ---------------------------------------------------------------------
 * ENTIDAD DetalleCompra -> tabla `detalle_compras` (hija de Compra,
 * COMPOSICION P4).
 *
 * `subtotal` es columna GENERADA por MySQL (cantidad * precio_unitario):
 * JAMAS se inserta ni se actualiza; aqui se calcula en memoria con la
 * misma formula para devolver la fila completa.
 */

class DetalleCompra {
  #idDetalleCompra;
  #idCompra;
  #idProducto;
  #cantidad;
  #precioUnitario;
  #subtotal;
  #nombreProducto;

  constructor(
    id = null,
    idCompra = null,
    idProducto = null,
    cantidad = 1,
    precioUnitario = 0,
    subtotal = null
  ) {
    this.#idDetalleCompra = id;
    this.#idCompra = idCompra;
    this.#idProducto = idProducto;
    this.#cantidad = cantidad;
    this.#precioUnitario = precioUnitario;
    this.#subtotal = subtotal;
    this.#nombreProducto = null;
  }

  get id() {
    return this.#idDetalleCompra;
  }

  get idCompra() {
    return this.#idCompra;
  }

  set idCompra(valor) {
    this.#idCompra = valor;
  }

  get idProducto() {
    return this.#idProducto;
  }

  set idProducto(valor) {
    this.#idProducto = valor;
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

  get nombreProducto() {
    return this.#nombreProducto;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const detalle = new DetalleCompra(
      fila.id_detalle_compra,
      fila.id_compra,
      fila.id_producto,
      fila.cantidad,
      fila.precio_unitario,
      fila.subtotal
    );

    if (fila.nombre_producto !== undefined) {
      detalle.#nombreProducto = fila.nombre_producto;
    }

    return detalle;
  }

  /** Linea cruda del body del cliente (sin id ni subtotal). */
  static desdeJSON(datos = {}) {
    return new DetalleCompra(
      null,
      null,
      datos.idProducto ?? datos.id_producto ?? null,
      datos.cantidad ?? 1,
      datos.precioUnitario ?? datos.precio_unitario ?? 0
    );
  }

  /** Fila para INSERT (NUNCA incluye subtotal: es columna generada). */
  aFilaInsercion(idCompra) {
    return {
      id_compra: idCompra,
      id_producto: this.#idProducto,
      cantidad: this.#cantidad,
      precio_unitario: this.#precioUnitario
    };
  }

  toJSON() {
    return {
      id: this.#idDetalleCompra,
      idCompra: this.#idCompra,
      idProducto: this.#idProducto,
      nombreProducto: this.#nombreProducto,
      cantidad: this.#cantidad,
      precioUnitario: this.#precioUnitario,
      subtotal: this.subtotal
    };
  }
}

module.exports = DetalleCompra;
