/**
 * src/models/AgendaEvento.js
 * ---------------------------------------------------------------------
 * ENTIDAD AgendaEvento -> tabla `agenda_eventos` (programacion de
 * actividades de un evento — RN-08).
 *
 * `#nombreEvento` viene del JOIN (solo lectura). El FK a `evento` es
 * ON DELETE CASCADE: al borrar el evento su agenda desaparece.
 */

const { ESTADO_AGENDA } = require('../utils/constants');

class AgendaEvento {
  #idAgendaEvento;
  #idEvento;
  #fecha;
  #hora;
  #descripcion;
  #estado;
  #nombreEvento;

  constructor(
    id = null,
    idEvento = null,
    fecha = null,
    hora = null,
    descripcion = null,
    estado = ESTADO_AGENDA.PROGRAMADA
  ) {
    this.#idAgendaEvento = id;
    this.#idEvento = idEvento;
    this.#fecha = fecha;
    this.#hora = hora;
    this.#descripcion = descripcion;
    this.#estado = estado;
    this.#nombreEvento = null;
  }

  get id() {
    return this.#idAgendaEvento;
  }

  get idEvento() {
    return this.#idEvento;
  }

  set idEvento(valor) {
    this.#idEvento = valor;
  }

  get fecha() {
    return this.#fecha;
  }

  set fecha(valor) {
    this.#fecha = valor;
  }

  get hora() {
    return this.#hora;
  }

  set hora(valor) {
    this.#hora = valor;
  }

  get descripcion() {
    return this.#descripcion;
  }

  set descripcion(valor) {
    this.#descripcion = valor;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  get nombreEvento() {
    return this.#nombreEvento;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const agenda = new AgendaEvento(
      fila.id_agenda_evento,
      fila.id_evento,
      fila.fecha,
      fila.hora,
      fila.descripcion,
      fila.estado
    );

    if (fila.nombre_evento !== undefined) {
      agenda.#nombreEvento = fila.nombre_evento;
    }

    return agenda;
  }

  aFilaBaseDatos() {
    return {
      id_evento: this.#idEvento,
      fecha: this.#fecha,
      hora: this.#hora,
      descripcion: this.#descripcion,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idAgendaEvento,
      idEvento: this.#idEvento,
      nombreEvento: this.#nombreEvento,
      fecha: this.#fecha,
      hora: this.#hora,
      descripcion: this.#descripcion,
      estado: this.#estado
    };
  }
}

module.exports = AgendaEvento;
