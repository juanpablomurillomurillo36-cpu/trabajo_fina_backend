/**
 * src/models/Proveedor.js
 * ---------------------------------------------------------------------
 * ENTIDAD Proveedor -> tabla `proveedores`.
 *
 * Quien abastece la discoteca (bebidas, sonido, insumos). Es un
 * CATALOGO basico: nombre, NIT, contacto y estado.
 *
 * NOTA DE ESQUEMA: el plan de trabajo hablaba de "RFC unico", pero el
 * esquema real (que manda, ver database/CAMBIOS.md) trae columna `nit`
 * con indice unico `uq_proveedores_nit`. La validacion de unicidad
 * se aplica sobre NIT.
 *
 * REGLAS DE POO
 *   P1 Privados # + getters/setters (el setter de email ademas
 *      normaliza a minusculas y el de nombre recorta espacios).
 *   P6 Polimorfismo: desdeFila(), desdeJSON(), aFilaBaseDatos(),
 *      toJSON().
 */

const { ESTADO } = require('../utils/constants');

class Proveedor {
  #idProveedor;
  #nombre;
  #nit;
  #telefono;
  #email;
  #direccion;
  #estado;

  /**
   * @param {number|null} id
   * @param {string}      nombre     VARCHAR(120) NOT NULL.
   * @param {string|null} nit        VARCHAR(30) UNIQUE (puede ser null).
   * @param {string|null} telefono   VARCHAR(20).
   * @param {string|null} email      VARCHAR(120).
   * @param {string|null} direccion  VARCHAR(200).
   * @param {string}      estado     'activo' | 'inactivo'.
   */
  constructor(
    id = null,
    nombre = '',
    nit = null,
    telefono = null,
    email = null,
    direccion = null,
    estado = ESTADO.ACTIVO
  ) {
    this.#idProveedor = id;
    this.#estado = estado;

    // Se asignan POR SETTER para que la normalizacion (recorte y
    // minusculas) aplique en TODOS los caminos de creacion.
    this.nombre = nombre;
    this.nit = nit;
    this.telefono = telefono;
    this.email = email;
    this.direccion = direccion;
  }

  // =====================================================================
  // GETTERS Y SETTERS
  // =====================================================================

  get id() {
    return this.#idProveedor;
  }

  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    this.#nombre = typeof valor === 'string' ? valor.trim() : '';
  }

  get nit() {
    return this.#nit;
  }

  set nit(valor) {
    const limpio = typeof valor === 'string' ? valor.trim() : '';
    this.#nit = limpio === '' ? null : limpio;
  }

  get telefono() {
    return this.#telefono;
  }

  set telefono(valor) {
    const limpio = typeof valor === 'string' ? valor.trim() : '';
    this.#telefono = limpio === '' ? null : limpio;
  }

  get email() {
    return this.#email;
  }

  set email(valor) {
    const limpio = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
    this.#email = limpio === '' ? null : limpio;
  }

  get direccion() {
    return this.#direccion;
  }

  set direccion(valor) {
    const limpio = typeof valor === 'string' ? valor.trim() : '';
    this.#direccion = limpio === '' ? null : limpio;
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

  // =====================================================================
  // FABRICAS ESTATICAS
  // =====================================================================

  /**
   * Fila de MySQL -> objeto Proveedor.
   *
   * @param {object} fila
   * @returns {Proveedor|null}
   */
  static desdeFila(fila) {
    if (!fila) return null;

    return new Proveedor(
      fila.id_proveedor,
      fila.nombre,
      fila.nit,
      fila.telefono,
      fila.email,
      fila.direccion,
      fila.estado
    );
  }

  /**
   * JSON ya normalizado por el service -> objeto Proveedor.
   *
   * @param {object} datos
   * @returns {Proveedor}
   */
  static desdeJSON(datos = {}) {
    return new Proveedor(
      datos.id ?? datos.idProveedor ?? null,
      datos.nombre ?? '',
      datos.nit ?? null,
      datos.telefono ?? null,
      datos.email ?? null,
      datos.direccion ?? null,
      datos.estado ?? ESTADO.ACTIVO
    );
  }

  // =====================================================================
  // SERIALIZACION
  // =====================================================================

  /**
   * Formato de fila para INSERT/UPDATE (snake_case).
   *
   * @returns {object}
   */
  aFilaBaseDatos() {
    return {
      nombre: this.#nombre,
      nit: this.#nit,
      telefono: this.#telefono,
      email: this.#email,
      direccion: this.#direccion,
      estado: this.#estado
    };
  }

  /**
   * Serializacion para el cliente (camelCase).
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.#idProveedor,
      nombre: this.#nombre,
      nit: this.#nit,
      telefono: this.#telefono,
      email: this.#email,
      direccion: this.#direccion,
      estado: this.#estado,
      activo: this.estaActivo()
    };
  }
}

module.exports = Proveedor;
