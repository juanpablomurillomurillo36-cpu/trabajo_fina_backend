/**
 * src/controllers/agendaEvento.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> AgendaEventoService. Bitacora en cada mutacion (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const agendaEventoService = require('../services/agenda-evento.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'agenda_eventos';

class AgendaEventoController {
  /** GET /api/agenda-eventos */
  listar = capturarAsync(async (req, res) => {
    const { actividades, total, pagina, limite } = await agendaEventoService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('actividades de agenda'),
      datos: actividades,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: actividades.length })
    });
  });

  /** GET /api/agenda-eventos/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const actividad = await agendaEventoService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Actividad de agenda'),
      datos: actividad
    });
  });

  /** POST /api/agenda-eventos -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const actividad = await agendaEventoService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: actividad.id,
      detalle: `Actividad ${actividad.fecha} ${actividad.hora} del evento #${actividad.idEvento} creada`
    });

    res.set('Location', `/api/agenda-eventos/${actividad.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Actividad de agenda'),
      datos: actividad
    });
  });

  /** PUT /api/agenda-eventos/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const actividad = await agendaEventoService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Actividad #${id} editada: ${actividad.fecha} ${actividad.hora}`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Actividad de agenda'),
      datos: actividad
    });
  });

  /** PATCH /api/agenda-eventos/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const actividad = await agendaEventoService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado de la actividad #${id}: ahora "${actividad.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: actividad
    });
  });

  /** DELETE /api/agenda-eventos/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const actividad = await agendaEventoService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Actividad #${id} (${actividad.fecha} ${actividad.hora}) eliminada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Actividad de agenda'),
      datos: actividad
    });
  });
}

// Singleton.
module.exports = new AgendaEventoController();
