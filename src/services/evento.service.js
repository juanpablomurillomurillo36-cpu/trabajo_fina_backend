/**
 * src/services/evento.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `evento` (fase 38):
 *  - nombre obligatorio (max 150); tematica opcional (max 150) -> 400.
 *  - fecha obligatoria (dia pasado o futuro: los eventos se archivan)
 *    -> 400.
 *  - horas opcionales; si vienen ambas, horaFin > horaInicio -> 400.
 *  - estado: programado | en_curso | finalizado | cancelado.
 *
 * Regla de la fase 39 (RN-07): no se elimina un evento que aun tiene
 * ficha tecnica -> 409 FICHA_NO_ELIMINABLE (la ficha se borra primero
 * con DELETE /api/eventos/:id/ficha).
 *  Fase 40 agrega agenda + notificaciones.
 *  Sin try/catch (R-ASYNC).
 */

const eventoRepository = require('../repositories/EventoRepository');
const notificacionService = require('./notificacion.service');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const fechas = require('../utils/fechas');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO_EVENTO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = Object.values(ESTADO_EVENTO);
// Columnas de la tabla: nombre y tematica VARCHAR(150).
const MAXIMO_NOMBRE = 150;
const MAXIMO_TEMATICA = 150;

/**
 * @param {object} cuerpo
 * @param {string} [estadoActual]  Se conserva en PUT si el body no trae estado.
 * @returns {Promise<object>} datos snake_case.
 */
function preparar(cuerpo, estadoActual = ESTADO_EVENTO.PROGRAMADO) {
  const colector = new ColectorErrores();

  colector.exigirTexto('nombre', cuerpo?.nombre, { requerido: true, maximo: MAXIMO_NOMBRE });
  colector.exigirTexto('tematica', cuerpo?.tematica, { requerido: false, maximo: MAXIMO_TEMATICA });

  colector.exigirFecha('fecha', cuerpo?.fecha, {
    requerido: true,
    permitirFutura: true,
    permitirPasada: true
  });
  colector.exigirHora('horaInicio', cuerpo?.horaInicio, { requerido: false });
  colector.exigirHora('horaFin', cuerpo?.horaFin, { requerido: false });

  const horaInicio = formato.aHoraONulo(cuerpo?.horaInicio);
  const horaFin = formato.aHoraONulo(cuerpo?.horaFin);
  if (horaInicio !== null && horaFin !== null && horaFin <= horaInicio) {
    colector.agregar('horaFin', 'Debe ser posterior a horaInicio');
  }

  let estado = estadoActual;
  if (cuerpo?.estado !== undefined) {
    colector.exigirValorDeLista('estado', cuerpo.estado, ESTADOS_PERMITIDOS);
    estado = cuerpo.estado;
  }

  colector.lanzarSiHay();

  const iso = fechas.aFechaISO(cuerpo?.fecha);

  return {
    nombre: formato.limpiarTexto(cuerpo?.nombre) || '',
    tematica: formato.limpiarTexto(cuerpo?.tematica) || null,
    fecha: iso === null ? null : iso.slice(0, 10),
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    estado
  };
}

class EventoService {
  /** ?estado=&fecha=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const fechaIso = fechas.aFechaISO(filtros.fecha);
    const fecha = fechaIso === null ? null : fechaIso.slice(0, 10);
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await eventoRepository.listar({ estado, fecha, busqueda, pagina, limite });
    return { eventos: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const evento = await eventoRepository.obtenerPorId(id);
    if (evento === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('evento'));
    }
    return evento.toJSON();
  }

  async crear(cuerpo) {
    const datos = preparar(cuerpo);
    const id = await eventoRepository.crear(datos);
    const evento = await this.obtenerPorId(id);

    // RN-12 (fase 40): al nacer el evento se SIMULA el aviso a todos
    // los clientes activos (filas en notificaciones + aviso en log).
    await notificacionService.notificarNuevoEvento(evento);

    return evento;
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = preparar(cuerpo, actual.estado);
    await eventoRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await eventoRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  /**
   * Baja fisica. RN-07: primero hay que quitar la ficha tecnica si
   * existe -> 409 FICHA_NO_ELIMINABLE (el ON DELETE CASCADE de la BD
   * seria el respaldo, pero la regla exige la eliminacion explicita).
   */
  async eliminar(id) {
    const evento = await this.obtenerPorId(id);

    if (await eventoRepository.tieneFichaTecnica(id)) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.FICHA_NO_ELIMINABLE);
    }

    await eventoRepository.eliminar(id);
    return evento;
  }
}

// Singleton.
module.exports = new EventoService();
