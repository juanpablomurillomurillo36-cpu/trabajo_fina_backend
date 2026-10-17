/**
 * src/controllers/notificacion.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> NotificacionService. La creacion deja el aviso simulado en
 * el log (lo hace el service) y su registro en bitacora (aqui).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const notificacionService = require('../services/notificacion.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'notificaciones';

class NotificacionController {
  /** GET /api/notificaciones */
  listar = capturarAsync(async (req, res) => {
    const { notificaciones, total, pagina, limite } = await notificacionService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('notificaciones'),
      datos: notificaciones,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: notificaciones.length })
    });
  });

  /** GET /api/notificaciones/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const notificacion = await notificacionService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Notificacion'),
      datos: notificacion
    });
  });

  /** POST /api/notificaciones -> 201 + Location (envio simulado) */
  crear = capturarAsync(async (req, res) => {
    const notificacion = await notificacionService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: notificacion.id,
      detalle: `Notificacion ${notificacion.tipo}/${notificacion.canal} al cliente #${notificacion.idCliente} (simulada)`
    });

    res.set('Location', `/api/notificaciones/${notificacion.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Notificacion'),
      datos: notificacion
    });
  });
}

// Singleton.
module.exports = new NotificacionController();
