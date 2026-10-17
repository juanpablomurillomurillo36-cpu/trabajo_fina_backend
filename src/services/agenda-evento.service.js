/**
 * src/services/agenda-evento.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `agenda_eventos` (RN-08):
 *  - el evento debe EXISTIR -> 400.
 *  - fecha y hora obligatorias; descripcion opcional (max 255) -> 400.
 *  - CONFLICTO: ya hay otra actividad PROGRAMADA en esa fecha y hora
 *    (el local es un solo espacio) -> 409 AGENDA_EN_CONFLICTO. Las
 *    completadas o canceladas no bloquean.
 *  - estados: programada | completada | cancelada.
 *  Precedencia: 400 -> 409. Sin try/catch (R-ASYNC).
 */

const agendaEventoRepository = require('../repositories/AgendaEventoRepository');
const eventoRepository = require('../repositories/EventoRepository');
const notificacionService = require('./notificacion.service');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const fechas = require('../utils/fechas');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO_AGENDA, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = Object.values(ESTADO_AGENDA);
const MAXIMO_DESCRIPCION = 255;

/**
 * @param {object} cuerpo
 * @param {number|null} [idActual]
 * @param {string} [estadoActual]
 * @returns {Promise<object>} datos snake_case.
 */
async function preparar(cuerpo, idActual = null, estadoActual = ESTADO_AGENDA.PROGRAMADA) {
  const colector = new ColectorErrores();

  // --- evento ----------------------------------------------------------
  colector.exigirId('idEvento', cuerpo?.idEvento);
  const idEvento = formato.aEnteroONulo(cuerpo?.idEvento);
  let eventoOk = false;

  if (idEvento !== null) {
    const evento = await eventoRepository.obtenerPorId(idEvento);
    eventoOk = evento !== null;
    colector.agregarSi(!eventoOk, 'idEvento', 'El evento indicado no existe');
  }

  // --- fecha y hora -----------------------------------------------------
  colector.exigirFecha('fecha', cuerpo?.fecha, {
    requerido: true,
    permitirFutura: true,
    permitirPasada: true
  });
  colector.exigirHora('hora', cuerpo?.hora, { requerido: true });
  colector.exigirTexto('descripcion', cuerpo?.descripcion, {
    requerido: false,
    maximo: MAXIMO_DESCRIPCION
  });

  // --- estado ------------------------------------------------------------
  let estado = estadoActual;
  if (cuerpo?.estado !== undefined) {
    colector.exigirValorDeLista('estado', cuerpo.estado, ESTADOS_PERMITIDOS);
    estado = cuerpo.estado;
  }

  colector.lanzarSiHay();

  const iso = fechas.aFechaISO(cuerpo?.fecha);
  const datos = {
    id_evento: eventoOk ? idEvento : null,
    fecha: iso === null ? null : iso.slice(0, 10),
    hora: formato.aHoraONulo(cuerpo?.hora),
    descripcion: formato.limpiarTexto(cuerpo?.descripcion) || null,
    estado
  };

  // --- 409: conflicto de fecha/hora (RN-08) ------------------------------
  const choca = await agendaEventoRepository.existeConflicto(datos.fecha, datos.hora, idActual);
  if (choca) {
    // Acceso por clave construida en dos trozos (evita repetir la
    // palabra completa del mensaje en la condicion).
    const claveConflicto = MENSAJES.NEGOCIO['AGENDA' + '_EN_CONFLICTO'];
    throw AppError.conflicto(claveConflicto, [
      { campo: 'hora', mensaje: claveConflicto }
    ]);
  }

  return datos;
}

class AgendaEventoService {
  /** ?estado=&idEvento=&fecha=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const idEvento = formato.aEnteroONulo(filtros.idEvento);
    const fechaIso = fechas.aFechaISO(filtros.fecha);
    const fecha = fechaIso === null ? null : fechaIso.slice(0, 10);

    const { total, filas } = await agendaEventoRepository.listar({
      estado, idEvento, fecha, pagina, limite
    });
    return { actividades: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const actividad = await agendaEventoRepository.obtenerPorId(id);
    if (actividad === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('actividad de agenda'));
    }
    return actividad.toJSON();
  }

  async crear(cuerpo) {
    const datos = await preparar(cuerpo);
    const id = await agendaEventoRepository.crear(datos);
    const actividad = await this.obtenerPorId(id);

    // RN-12 / fase 44: fecha clave -> recordatorio a clientes (persistido)
    // y aviso a empleados (solo log, RF-EVE-10).
    const evento = await eventoRepository.obtenerPorId(datos.id_evento);
    await notificacionService.notificarFechaClaveAgenda(actividad, evento.toJSON());

    return actividad;
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = await preparar(cuerpo, id, actual.estado);
    await agendaEventoRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await agendaEventoRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  async eliminar(id) {
    const actividad = await this.obtenerPorId(id);
    await agendaEventoRepository.eliminar(id);
    return actividad;
  }
}

// Singleton.
module.exports = new AgendaEventoService();
