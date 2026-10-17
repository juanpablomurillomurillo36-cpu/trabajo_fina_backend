/**
 * src/models/Compra.js
 * ---------------------------------------------------------------------
 * ENTIDAD Compra -> tabla `compras` (RN-01).
 *
 * COMPOSICION (P4): la compra es la PROPIETARIA de sus lineas
 * (`detalle_compras`). Sin compra no existen los detalles y al borrar
 * la compra MySQL los borra en cascada. Por eso:
 *   - los detalles viajan COMO ARREGLO dentro de la compra (#detalles);
 *   - NO existe endpoint CRUD independiente para detalle_compras;
 *   - el total SIEMPRE se recalcula como suma de subtotales.
 *
 * `#nombreProveedor` viene del JOIN (solo lectura).
 */

const { ESTADO } = require('../utils/constants');

class Compra {
  #idCompra;
  #idProveedor;
  #fechaCompra;
  #total;
  #estado;
  #detalles;
  #nombreProveedor;

  constructor(
    id = null,
    idProveedor = null,
    fechaCompra = null,
    total = 0,
    estado = 'pendiente'
  ) {
    this.#idCompra = id;
    this.#idProveedor = idProveedor;
    this.#fechaCompra = fechaCompra;
    this.#total = Number(total) || 0;
    this.#estado = estado;
    this.#detalles = null; // null = aun no se cargan; [] = cargados vacios.
    this.#nombreProveedor = null;
  }

  get id() {
    return this.#idCompra;
  }

  get idProveedor() {
    return this.#idProveedor;
  }

  set idProveedor(valor) {
    this.#idProveedor = valor;
  }

  get fechaCompra() {
    return this.#fechaCompra;
  }

  set fechaCompra(valor) {
    this.#fechaCompra = valor;
  }

  get total() {
    return this.#total;
  }

  set total(valor) {
    const numero = Number(valor);
    this.#total = Number.isFinite(numero) ? numero : 0;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  get detalles() {
    return this.#detalles;
  }

  set detalles(lista) {
    this.#detalles = Array.isArray(lista) ? lista : null;
  }

  get nombreProveedor() {
    return this.#nombreProveedor;
  }

  estaPendiente() {
    return this.#estado === 'pendiente';
  }

  /** Suma de subtotales: unica fuente de verdad del total. */
  recalcularTotal() {
    if (!Array.isArray(this.#detalles)) return;
    this.#total = this.#detalles.reduce((suma, d) => suma + (Number(d.subtotal) || 0), 0);
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const compra = new Compra(
      fila.id_compra,
      fila.id_proveedor,
      fila.fecha_compra,
      fila.total,
      fila.estado
    );

    if (fila.nombre_proveedor !== undefined) {
      compra.#nombreProveedor = fila.nombre_proveedor;
    }

    return compra;
  }

  static desdeJSON(datos = {}) {
    return new Compra(
      datos.id ?? datos.idCompra ?? null,
      datos.idProveedor ?? null,
      datos.fechaCompra ?? null,
      datos.total ?? 0,
      datos.estado ?? 'pendiente'
    );
  }

  aFilaBaseDatos() {
    return {
      id_proveedor: this.#idProveedor,
      fecha_compra: this.#fechaCompra,
      total: this.#total,
      estado: this.#estado
    };
  }

  toJSON() {
    const json = {
      id: this.#idCompra,
      idProveedor: this.#idProveedor,
      fechaCompra: this.#fechaCompra,
      total: this.#total,
      estado: this.#estado,
      pendiente: this.estaPendiente(),
      nombreProveedor: this.#nombreProveedor
    };

    // Solo se incluye si alguien cargo los detalles (obtenerConDetalles).
    if (this.#detalles !== null) json.detalles = this.#detalles;

    return json;
  }
}

module.exports = Compra;
