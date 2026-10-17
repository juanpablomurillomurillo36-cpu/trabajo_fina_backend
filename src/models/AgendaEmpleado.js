/**
 * src/models/AgendaEmpleado.js
 * ---------------------------------------------------------------------
 * ENTIDAD AgendaEmpleado -> tabla `agenda_empleados`.
 *
 * Turno del personal. RESTRICCION DE ESQUEMA: el CHECK
 * `chk_agendaempleado_asociacion` exige que UNA Y SOLO UNA de estas
 * dos asociaciones exista: id_servicio XOR id_evento. La valida el
 * service antes de tocar la base.
 *
 * `#nombreEmpleado` viene del JOIN (solo lectura).
 */

const { ESTADO_AGENDA } = require('../utils/constants');

class AgendaEmpleado {
  #idAgendaEmpleado;
  #idEmpleado;
  #idServicio;
  #idEvento;
  #fecha;
  #horaInicio;
  #horaFin;
  #estado;
  #nombreEmpleado;

  constructor(
    id = null,
    idEmpleado = null,
    idServicio = null,
    idEvento = null,
    fecha = null,
    horaInicio = null,
    horaFin = null,
    estado = ESTADO_AGENDA.PROGRAMADA
  ) {
    this.#idAgendaEmpleado = id;
    this.#idEmpleado = idEmpleado;
    this.#idServicio = idServicio;
    this.#idEvento = idEvento;
    this.#fecha = fecha;
    this.#horaInicio = horaInicio;
    this.#horaFin = horaFin;
    this.#estado = estado;
    this.#nombreEmpleado = null;
  }

  get id() {
    return this.#idAgendaEmpleado;
  }

  get idEmpleado() {
    return this.#idEmpleado;
  }

  set idEmpleado(valor) {
    this.#idEmpleado = valor;
  }

  get idServicio() {
    return this.#idServicio;
  }

  set idServicio(valor) {
    this.#idServicio = valor;
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

  get nombreEmpleado() {
    return this.#nombreEmpleado;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const turno = new AgendaEmpleado(
      fila.id_agenda_empleado,
      fila.id_empleado,
      fila.id_servicio,
      fila.id_evento,
      fila.fecha,
      fila.hora_inicio,
      fila.hora_fin,
      fila.estado
    );

    if (fila.nombre_empleado !== undefined) {
      turno.#nombreEmpleado = fila.nombre_empleado;
    }

    return turno;
  }

  static desdeJSON(datos = {}) {
    return new AgendaEmpleado(
      datos.id ?? datos.idAgendaEmpleado ?? null,
      datos.idEmpleado ?? null,
      datos.idServicio ?? null,
      datos.idEvento ?? null,
      datos.fecha ?? null,
      datos.horaInicio ?? null,
      datos.horaFin ?? null,
      datos.estado ?? ESTADO_AGENDA.PROGRAMADA
    );
  }

  aFilaBaseDatos() {
    return {
      id_empleado: this.#idEmpleado,
      id_servicio: this.#idServicio,
      id_evento: this.#idEvento,
      fecha: this.#fecha,
      hora_inicio: this.#horaInicio,
      hora_fin: this.#horaFin,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idAgendaEmpleado,
      idEmpleado: this.#idEmpleado,
      nombreEmpleado: this.#nombreEmpleado,
      idServicio: this.#idServicio,
      idEvento: this.#idEvento,
      fecha: this.#fecha,
      horaInicio: this.#horaInicio,
      horaFin: this.#horaFin,
      estado: this.#estado
    };
  }
}

module.exports = AgendaEmpleado;
