/**
 * src/services/agenda-empleado.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `agenda_empleados` (fase 32):
 *  - empleado obligatorio, debe EXISTIR y estar ACTIVO -> 400.
 *  - asociacion XOR: EXACTAMENTE UNA entre idServicio e idEvento
 *    (CHECK chk_agendaempleado_asociacion de MySQL) -> 400.
 *  - la asociacion indicada debe existir (servicio activo / evento).
 *  - horaInicio requerida; horaFin opcional pero si viene debe ser
 *    posterior a horaInicio -> 400.
 *  - CONFLICTO: el empleado no puede tener dos turnos que se
 *    superpongan en la misma fecha -> 409 TURNO_SUPERPUESTO (solo
 *    chocan turnos programados o completados; cancelados no bloquean).
 *  Precedencia: 400 -> 409. Sin try/catch (R-ASYNC).
 */

const agendaEmpleadoRepository = require('../repositories/AgendaEmpleadoRepository');
const empleadoRepository = require('../repositories/EmpleadoRepository');
const servicioRepository = require('../repositories/ServicioRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const fechas = require('../utils/fechas');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO_AGENDA, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = Object.values(ESTADO_AGENDA);

/**
 * @param {object} cuerpo
 * @param {number|null} [idActual]
 * @param {string} [estadoActual]
 * @returns {Promise<object>} datos snake_case.
 */
async function preparar(cuerpo, idActual = null, estadoActual = ESTADO_AGENDA.PROGRAMADA) {
  const colector = new ColectorErrores();
  const datos = {};

  // --- empleado -------------------------------------------------------
  colector.exigirId('idEmpleado', cuerpo?.idEmpleado);
  const idEmpleado = formato.aEnteroONulo(cuerpo?.idEmpleado);
  let empleadoOk = false;

  if (idEmpleado !== null) {
    const empleado = await empleadoRepository.obtenerPorId(idEmpleado);
    if (empleado === null) {
      colector.agregar('idEmpleado', 'El empleado indicado no existe');
    } else if (!empleado.estaActivo()) {
      colector.agregar('idEmpleado', 'El empleado indicado esta inactivo');
    } else {
      empleadoOk = true;
    }
  }
  datos.id_empleado = empleadoOk ? idEmpleado : null;

  // --- asociacion XOR: UNA y solo UNA ---------------------------------
  const idServicio = formato.aEnteroONulo(cuerpo?.idServicio);
  const idEvento = formato.aEnteroONulo(cuerpo?.idEvento);

  if ((idServicio !== null && idEvento !== null) || (idServicio === null && idEvento === null)) {
    colector.agregar(
      'idServicio',
      'Debe indicar exactamente una asociacion: idServicio o idEvento (no ambas ni ninguna)'
    );
  }

  if (idServicio !== null) {
    const servicio = await servicioRepository.obtenerPorId(idServicio);
    if (servicio === null) {
      colector.agregar('idServicio', 'El servicio indicado no existe');
    } else if (!servicio.estaActivo()) {
      colector.agregar('idServicio', 'El servicio indicado esta inactivo');
    }
  }

  if (idEvento !== null && !(await agendaEmpleadoRepository.existeEvento(idEvento))) {
    colector.agregar('idEvento', 'El evento indicado no existe');
  }

  datos.id_servicio = idServicio;
  datos.id_evento = idEvento;

  // --- fecha (cualquier dia: pasada o futura) --------------------------
  colector.exigirFecha('fecha', cuerpo?.fecha, {
    requerido: true,
    permitirFutura: true,
    permitirPasada: true
  });
  const iso = fechas.aFechaISO(cuerpo?.fecha);
  datos.fecha = iso === null ? null : iso.slice(0, 10);

  // --- horas -----------------------------------------------------------
  colector.exigirHora('horaInicio', cuerpo?.horaInicio, { requerido: true });
  colector.exigirHora('horaFin', cuerpo?.horaFin, { requerido: false });

  const horaInicio = formato.aHoraONulo(cuerpo?.horaInicio);
  const horaFin = formato.aHoraONulo(cuerpo?.horaFin);
  datos.hora_inicio = horaInicio;
  datos.hora_fin = horaFin;

  if (horaInicio !== null && horaFin !== null && horaFin <= horaInicio) {
    colector.agregar('horaFin', 'Debe ser posterior a horaInicio');
  }

  // --- estado ----------------------------------------------------------
  if (cuerpo?.estado !== undefined) {
    colector.exigirValorDeLista('estado', cuerpo.estado, ESTADOS_PERMITIDOS);
    datos.estado = cuerpo.estado;
  } else {
    datos.estado = estadoActual;
  }

  colector.lanzarSiHay();

  // --- 409: solapamiento del turno del empleado -------------------------
  if (empleadoOk && datos.fecha !== null && horaInicio !== null) {
    const choca = await agendaEmpleadoRepository.existeSolapamiento(
      datos.id_empleado,
      datos.fecha,
      horaInicio,
      horaFin,
      idActual
    );
    if (choca) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.TURNO_SUPERPUESTO, [
        { campo: 'horaInicio', mensaje: MENSAJES.NEGOCIO.TURNO_SUPERPUESTO }
      ]);
    }
  }

  return datos;
}

class AgendaEmpleadoService {
  /** ?estado=&idEmpleado=&fecha=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const idEmpleado = formato.aEnteroONulo(filtros.idEmpleado);
    const fechaIso = fechas.aFechaISO(filtros.fecha);
    const fecha = fechaIso === null ? null : fechaIso.slice(0, 10);

    const { total, filas } = await agendaEmpleadoRepository.listar({
      estado, idEmpleado, fecha, pagina, limite
    });
    return { turnos: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const turno = await agendaEmpleadoRepository.obtenerPorId(id);
    if (turno === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('turno de agenda'));
    }
    return turno.toJSON();
  }

  async crear(cuerpo) {
    const datos = await preparar(cuerpo);
    const id = await agendaEmpleadoRepository.crear(datos);
    return this.obtenerPorId(id);
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = await preparar(cuerpo, id, actual.estado);
    await agendaEmpleadoRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await agendaEmpleadoRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  async eliminar(id) {
    const turno = await this.obtenerPorId(id);
    await agendaEmpleadoRepository.eliminar(id);
    return turno;
  }
}

// Singleton.
module.exports = new AgendaEmpleadoService();
