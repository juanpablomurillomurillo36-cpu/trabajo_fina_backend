/**
 * src/models/Producto.js
 * ---------------------------------------------------------------------
 * ENTIDAD Producto -> tabla `productos`.
 *
 * Catalogo de venta (bebidas, snacks, souvenirs). Ademas de los campos
 * basicos lleva la existencia: `stock_actual`, `stock_minimo` y
 * `stock_maximo` (RN-03: alertas de stock).
 *
 * REGLAS DE POO
 *   P1 Privados # + getters/setters (el setter de nombre recorta y el
 *      de precio normaliza a numero).
 *   P6 Polimorfismo: desdeFila(), desdeJSON(), aFilaBaseDatos(),
 *      toJSON() — que ademas expone `bajoStock` para que la capa de
 *      presentacion no tenga que recalcularlo.
 */

const { ESTADO } = require('../utils/constants');

class Producto {
  #idProducto;
  #nombre;
  #descripcion;
  #precioVenta;
  #stockActual;
  #stockMinimo;
  #stockMaximo;
  #estado;

  constructor(
    id = null,
    nombre = '',
    descripcion = null,
    precioVenta = 0,
    stockActual = 0,
    stockMinimo = 0,
    stockMaximo = 0,
    estado = ESTADO.ACTIVO
  ) {
    this.#idProducto = id;
    this.#estado = estado;

    this.nombre = nombre;
    this.descripcion = descripcion;
    this.precioVenta = precioVenta;
    this.stockActual = stockActual;
    this.stockMinimo = stockMinimo;
    this.stockMaximo = stockMaximo;
  }

  // =====================================================================
  // GETTERS Y SETTERS
  // =====================================================================

  get id() {
    return this.#idProducto;
  }

  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    this.#nombre = typeof valor === 'string' ? valor.trim() : '';
  }

  get descripcion() {
    return this.#descripcion;
  }

  set descripcion(valor) {
    const limpio = typeof valor === 'string' ? valor.trim() : '';
    this.#descripcion = limpio === '' ? null : limpio;
  }

  get precioVenta() {
    return this.#precioVenta;
  }

  set precioVenta(valor) {
    const numero = Number(valor);
    this.#precioVenta = Number.isFinite(numero) && numero >= 0 ? numero : 0;
  }

  get stockActual() {
    return this.#stockActual;
  }

  set stockActual(valor) {
    this.#stockActual = Producto.#aEnteroSeguro(valor);
  }

  get stockMinimo() {
    return this.#stockMinimo;
  }

  set stockMinimo(valor) {
    this.#stockMinimo = Producto.#aEnteroSeguro(valor);
  }

  get stockMaximo() {
    return this.#stockMaximo;
  }

  set stockMaximo(valor) {
    this.#stockMaximo = Producto.#aEnteroSeguro(valor);
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  estaActivo() {
    return this.#estado === ESTADO.ACTIVO;
  }

  /** RN-03: el actual esta por debajo del minimo (y hay minimo definido). */
  estaBajoStock() {
    return this.#stockMinimo > 0 && this.#stockActual < this.#stockMinimo;
  }

  // =====================================================================
  // UTILIDADES INTERNAS
  // =====================================================================

  /** Entero >= 0 o 0. */
  static #aEnteroSeguro(valor) {
    const numero = Math.trunc(Number(valor));
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
  }

  // =====================================================================
  // FABRICAS ESTATICAS
  // =====================================================================

  static desdeFila(fila) {
    if (!fila) return null;
    return new Producto(
      fila.id_producto,
      fila.nombre,
      fila.descripcion,
      fila.precio_venta,
      fila.stock_actual,
      fila.stock_minimo,
      fila.stock_maximo,
      fila.estado
    );
  }

  static desdeJSON(datos = {}) {
    return new Producto(
      datos.id ?? datos.idProducto ?? null,
      datos.nombre ?? '',
      datos.descripcion ?? null,
      datos.precioVenta ?? 0,
      datos.stockActual ?? 0,
      datos.stockMinimo ?? 0,
      datos.stockMaximo ?? 0,
      datos.estado ?? ESTADO.ACTIVO
    );
  }

  // =====================================================================
  // SERIALIZACION
  // =====================================================================

  aFilaBaseDatos() {
    return {
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      precio_venta: this.#precioVenta,
      stock_actual: this.#stockActual,
      stock_minimo: this.#stockMinimo,
      stock_maximo: this.#stockMaximo,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idProducto,
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      precioVenta: this.#precioVenta,
      stockActual: this.#stockActual,
      stockMinimo: this.#stockMinimo,
      stockMaximo: this.#stockMaximo,
      estado: this.#estado,
      activo: this.estaActivo(),
      bajoStock: this.estaBajoStock()
    };
  }
}

module.exports = Producto;
