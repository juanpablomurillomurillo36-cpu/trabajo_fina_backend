/**
 * src/models/CategoriaCliente.js
 * ---------------------------------------------------------------------
 * ENTIDAD CategoriaCliente -> tabla `categoria_clientes`.
 *
 * Segmenta los clientes (frecuente, nuevo, corporativo...). Sin indice
 * unico en MySQL: el nombre repetido se controla en el service (C-02).
 */

const { ESTADO } = require('../utils/constants');

class CategoriaCliente {
  #idCategoriaCliente;
  #nombre;
  #descripcion;
  #estado;

  constructor(id = null, nombre = '', descripcion = null, estado = ESTADO.ACTIVO) {
    this.#idCategoriaCliente = id;
    this.#estado = estado;
    this.nombre = nombre;
    this.descripcion = descripcion;
  }

  get id() {
    return this.#idCategoriaCliente;
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

  static desdeFila(fila) {
    if (!fila) return null;
    return new CategoriaCliente(
      fila.id_categoria_cliente,
      fila.nombre,
      fila.descripcion,
      fila.estado
    );
  }

  static desdeJSON(datos = {}) {
    return new CategoriaCliente(
      datos.id ?? datos.idCategoriaCliente ?? null,
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
      id: this.#idCategoriaCliente,
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      estado: this.#estado,
      activo: this.estaActivo()
    };
  }
}

module.exports = CategoriaCliente;
