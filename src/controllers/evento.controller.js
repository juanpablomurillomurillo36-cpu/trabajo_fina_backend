/**
 * src/controllers/evento.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> EventoService. Bitacora en cada mutacion (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const eventoService = require('../services/evento.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'evento';

class EventoController {
  /** GET /api/eventos */
  listar = capturarAsync(async (req, res) => {
    const { eventos, total, pagina, limite } = await eventoService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('eventos'),
      datos: eventos,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: eventos.length })
    });
  });

  /** GET /api/eventos/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const evento = await eventoService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Evento'),
      datos: evento
    });
  });

  /** POST /api/eventos -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const evento = await eventoService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: evento.id,
      detalle: `Evento "${evento.nombre}" ${evento.fecha} creado`
    });

    res.set('Location', `/api/eventos/${evento.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Evento'),
      datos: evento
    });
  });

  /** PUT /api/eventos/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const evento = await eventoService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Evento #${id} "${evento.nombre}" editado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Evento'),
      datos: evento
    });
  });

  /** PATCH /api/eventos/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const evento = await eventoService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado del evento #${id}: ahora "${evento.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: evento
    });
  });

  /** DELETE /api/eventos/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const evento = await eventoService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Evento #${id} "${evento.nombre}" eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Evento'),
      datos: evento
    });
  });
}

// Singleton.
module.exports = new EventoController();
