/**
 * src/models/Empleado.js
 * ---------------------------------------------------------------------
 * ENTIDAD Empleado -> tabla `empleados`.
 *
 * Ficha del personal (DJ, mesero, ingreso, administrativo) ligada a su
 * categoria. `documento` es UNICO en MySQL (el plan le llamaba NSS;
 * manda el esquema real).
 *
 * `#nombreCategoria` NO es columna propia: viene de un JOIN con
 * `categoria_empleado` y solo se llena en desdeFila() cuando la fila
 * lo trae. En aFilaBaseDatos() jamas se escribe (no romperia el UPDATE).
 *
 * POO: P1 privados + getters; P6 factories y toJSON().
 */

const { ESTADO } = require('../utils/constants');

class Empleado {
  #idEmpleado;
  #idCategoriaEmpleado;
  #nombre;
  #apellido;
  #documento;
  #telefono;
  #email;
  #estado;
  #nombreCategoria;

  constructor(
    id = null,
    idCategoriaEmpleado = null,
    nombre = '',
    apellido = '',
    documento = '',
    telefono = null,
    email = null,
    estado = ESTADO.ACTIVO
  ) {
    this.#idEmpleado = id;
    this.#idCategoriaEmpleado = idCategoriaEmpleado;
    this.#estado = estado;
    this.#nombreCategoria = null;

    this.nombre = nombre;
    this.apellido = apellido;
    this.documento = documento;
    this.telefono = telefono;
    this.email = email;
  }

  get id() {
    return this.#idEmpleado;
  }

  get idCategoriaEmpleado() {
    return this.#idCategoriaEmpleado;
  }

  set idCategoriaEmpleado(valor) {
    this.#idCategoriaEmpleado = valor;
  }

  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    this.#nombre = typeof valor === 'string' ? valor.trim() : '';
  }

  get apellido() {
    return this.#apellido;
  }

  set apellido(valor) {
    this.#apellido = typeof valor === 'string' ? valor.trim() : '';
  }

  get documento() {
    return this.#documento;
  }

  set documento(valor) {
    const limpio = typeof valor === 'string' ? valor.trim() : '';
    this.#documento = limpio === '' ? '' : limpio;
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

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  get nombreCategoria() {
    return this.#nombreCategoria;
  }

  estaActivo() {
    return this.#estado === ESTADO.ACTIVO;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const empleado = new Empleado(
      fila.id_empleado,
      fila.id_categoria_empleado,
      fila.nombre,
      fila.apellido,
      fila.documento,
      fila.telefono,
      fila.email,
      fila.estado
    );

    // Solo existe si la consulta trajo el JOIN.
    if (fila.nombre_categoria !== undefined) {
      empleado.#nombreCategoria = fila.nombre_categoria;
    }

    return empleado;
  }

  static desdeJSON(datos = {}) {
    return new Empleado(
      datos.id ?? datos.idEmpleado ?? null,
      datos.idCategoriaEmpleado ?? null,
      datos.nombre ?? '',
      datos.apellido ?? '',
      datos.documento ?? '',
      datos.telefono ?? null,
      datos.email ?? null,
      datos.estado ?? ESTADO.ACTIVO
    );
  }

  aFilaBaseDatos() {
    return {
      id_categoria_empleado: this.#idCategoriaEmpleado,
      nombre: this.#nombre,
      apellido: this.#apellido,
      documento: this.#documento,
      telefono: this.#telefono,
      email: this.#email,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idEmpleado,
      idCategoriaEmpleado: this.#idCategoriaEmpleado,
      nombre: this.#nombre,
      apellido: this.#apellido,
      documento: this.#documento,
      telefono: this.#telefono,
      email: this.#email,
      estado: this.#estado,
      activo: this.estaActivo(),
      nombreCategoria: this.#nombreCategoria
    };
  }
}

module.exports = Empleado;
