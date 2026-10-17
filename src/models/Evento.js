/**
 * src/models/Evento.js
 * ---------------------------------------------------------------------
 * ENTIDAD Evento -> tabla `evento` (fiestas/programacion del local).
 *
 * Sin FKs: la composicion 1:1 con `ficha_tecnica` y la agenda de
 * eventos llegan en las fases 39 y 40.
 */

const { ESTADO_EVENTO, TIPO_EVENTO } = require('../utils/constants');

class Evento {
  #idEvento;
  #nombre;
  #tematica;
  #tipoEvento;
  #fecha;
  #horaInicio;
  #horaFin;
  #estado;

  constructor(
    id = null,
    nombre = null,
    tematica = null,
    tipoEvento = TIPO_EVENTO.TEMATICO,
    fecha = null,
    horaInicio = null,
    horaFin = null,
    estado = ESTADO_EVENTO.PROGRAMADO
  ) {
    this.#idEvento = id;
    this.#nombre = nombre;
    this.#tematica = tematica;
    this.#tipoEvento = tipoEvento ?? TIPO_EVENTO.TEMATICO;
    this.#fecha = fecha;
    this.#horaInicio = horaInicio;
    this.#horaFin = horaFin;
    this.#estado = estado;
  }

  get id() {
    return this.#idEvento;
  }

  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    this.#nombre = valor;
  }

  get tematica() {
    return this.#tematica;
  }

  set tematica(valor) {
    this.#tematica = valor;
  }

  get tipoEvento() {
    return this.#tipoEvento;
  }

  set tipoEvento(valor) {
    this.#tipoEvento = valor;
  }

  get fecha() {
    return this.#fecha;
  }

  set fecha(valor) {
    this.#fecha = valor;
  }

  get horaInicio() {
    return this.#horaInicio;
  }

  set horaInicio(valor) {
    this.#horaInicio = valor;
  }

  get horaFin() {
    return this.#horaFin;
  }

  set horaFin(valor) {
    this.#horaFin = valor;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    return new Evento(
      fila.id_evento,
      fila.nombre,
      fila.tematica,
      fila.tipo_evento ?? TIPO_EVENTO.TEMATICO,
      fila.fecha,
      fila.hora_inicio,
      fila.hora_fin,
      fila.estado
    );
  }

  static desdeJSON(datos = {}) {
    return new Evento(
      datos.id ?? null,
      datos.nombre ?? null,
      datos.tematica ?? null,
      datos.tipoEvento ?? TIPO_EVENTO.TEMATICO,
      datos.fecha ?? null,
      datos.horaInicio ?? null,
      datos.horaFin ?? null,
      datos.estado ?? ESTADO_EVENTO.PROGRAMADO
    );
  }

  aFilaBaseDatos() {
    return {
      nombre: this.#nombre,
      tematica: this.#tematica,
      tipo_evento: this.#tipoEvento,
      fecha: this.#fecha,
      hora_inicio: this.#horaInicio,
      hora_fin: this.#horaFin,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idEvento,
      nombre: this.#nombre,
      tematica: this.#tematica,
      tipoEvento: this.#tipoEvento,
      fecha: this.#fecha,
      horaInicio: this.#horaInicio,
      horaFin: this.#horaFin,
      estado: this.#estado
    };
  }
}

module.exports = Evento;
