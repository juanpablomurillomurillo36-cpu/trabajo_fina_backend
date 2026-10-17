/**
 * src/models/DetalleVenta.js
 * ---------------------------------------------------------------------
 * ENTIDAD DetalleVenta -> tabla `detalle_ventas` (hija de Venta,
 * COMPOSICION P4).
 *
 * `subtotal` es columna GENERADA por MySQL (cantidad * precio_unitario):
 * JAMAS se inserta ni se actualiza. El precio sale del CATALOGO de
 * productos (fuente unica), nunca del body.
 */

class DetalleVenta {
  #idDetalleVenta;
  #idVenta;
  #idProducto;
  #cantidad;
  #precioUnitario;
  #subtotal;
  #nombreProducto;

  constructor(
    id = null,
    idVenta = null,
    idProducto = null,
    cantidad = 1,
    precioUnitario = 0,
    subtotal = null
  ) {
    this.#idDetalleVenta = id;
    this.#idVenta = idVenta;
    this.#idProducto = idProducto;
    this.#cantidad = cantidad;
    this.#precioUnitario = precioUnitario;
    this.#subtotal = subtotal;
    this.#nombreProducto = null;
  }

  get id() {
    return this.#idDetalleVenta;
  }

  get idVenta() {
    return this.#idVenta;
  }

  get idProducto() {
    return this.#idProducto;
  }

  get cantidad() {
    return this.#cantidad;
  }

  get precioUnitario() {
    return this.#precioUnitario;
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

    const detalle = new DetalleVenta(
      fila.id_detalle_venta,
      fila.id_venta,
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

  /** Linea cruda del body: solo idProducto y cantidad (el precio no). */
  static desdeJSON(datos = {}) {
    return new DetalleVenta(
      null,
      null,
      datos.idProducto ?? datos.id_producto ?? null,
      datos.cantidad ?? 1,
      0
    );
  }

  /** Fila para INSERT (NUNCA incluye subtotal: es columna generada). */
  aFilaInsercion(idVenta) {
    return {
      id_venta: idVenta,
      id_producto: this.#idProducto,
      cantidad: this.#cantidad,
      precio_unitario: this.#precioUnitario
    };
  }

  toJSON() {
    return {
      id: this.#idDetalleVenta,
      idVenta: this.#idVenta,
      idProducto: this.#idProducto,
      nombreProducto: this.#nombreProducto,
      cantidad: this.#cantidad,
      precioUnitario: this.#precioUnitario,
      subtotal: this.subtotal
    };
  }
}

module.exports = DetalleVenta;
