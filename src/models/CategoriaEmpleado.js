/**
 * src/models/CategoriaEmpleado.js
 * ---------------------------------------------------------------------
 * ENTIDAD CategoriaEmpleado -> tabla `categoria_empleado`.
 *
 * Distingue el tipo de personal (DJ, mesero, ingreso, administrativo).
 * OJO: `nombre` es un ENUM de MySQL con indice unico — la validacion
 * del dominio vive en CARGO_EMPLEADO (constants) y se aplica en el
 * service; aqui el setter solo normaliza el texto.
 */

const { ESTADO, CARGO_EMPLEADO } = require('../utils/constants');

class CategoriaEmpleado {
  #idCategoriaEmpleado;
  #nombre;
  #descripcion;
  #estado;

  constructor(id = null, nombre = '', descripcion = null, estado = ESTADO.ACTIVO) {
    this.#idCategoriaEmpleado = id;
    this.#estado = estado;
    this.nombre = nombre;
    this.descripcion = descripcion;
  }

  get id() {
    return this.#idCategoriaEmpleado;
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

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  estaActivo() {
    return this.#estado === ESTADO.ACTIVO;
  }

  /** Dominio valido del ENUM `categoria_empleado.nombre`. */
  static esCargoValido(nombre) {
    return Object.values(CARGO_EMPLEADO).includes(nombre);
  }

  static desdeFila(fila) {
    if (!fila) return null;
    return new CategoriaEmpleado(
      fila.id_categoria_empleado,
      fila.nombre,
      fila.descripcion,
      fila.estado
    );
  }

  static desdeJSON(datos = {}) {
    return new CategoriaEmpleado(
      datos.id ?? datos.idCategoriaEmpleado ?? null,
      datos.nombre ?? '',
      datos.descripcion ?? null,
      datos.estado ?? ESTADO.ACTIVO
    );
  }

  aFilaBaseDatos() {
    return {
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idCategoriaEmpleado,
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      estado: this.#estado,
      activo: this.estaActivo()
    };
  }
}

module.exports = CategoriaEmpleado;
