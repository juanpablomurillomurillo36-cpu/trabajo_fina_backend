/**
 * src/models/Servicio.js
 * ---------------------------------------------------------------------
 * ENTIDAD Servicio -> tabla `servicios`.
 *
 * Catalogo de servicios de la discoteca (mesa VIP, camarera, cabina,
 * etc.). Lo consumen: detalle_reserva (reservas), agenda_empleados y
 * ficha_servicio (eventos N:N).
 *
 * REGLAS DE POO: P1 privados # + getters; P6 factories y toJSON().
 */

const { ESTADO } = require('../utils/constants');

class Servicio {
  #idServicio;
  #nombre;
  #descripcion;
  #precio;
  #estado;

  constructor(
    id = null,
    nombre = '',
    descripcion = null,
    precio = 0,
    estado = ESTADO.ACTIVO
  ) {
    this.#idServicio = id;
    this.#estado = estado;

    this.nombre = nombre;
    this.descripcion = descripcion;
    this.precio = precio;
  }

  get id() {
    return this.#idServicio;
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

  get precio() {
    return this.#precio;
  }

  set precio(valor) {
    const numero = Number(valor);
    this.#precio = Number.isFinite(numero) && numero >= 0 ? numero : 0;
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
    return new Servicio(
      fila.id_servicio,
      fila.nombre,
      fila.descripcion,
      fila.precio,
      fila.estado
    );
  }

  static desdeJSON(datos = {}) {
    return new Servicio(
      datos.id ?? datos.idServicio ?? null,
      datos.nombre ?? '',
      datos.descripcion ?? null,
      datos.precio ?? 0,
      datos.estado ?? ESTADO.ACTIVO
    );
  }

  aFilaBaseDatos() {
    return {
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      precio: this.#precio,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idServicio,
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      precio: this.#precio,
      estado: this.#estado,
      activo: this.estaActivo()
    };
  }
}

module.exports = Servicio;
