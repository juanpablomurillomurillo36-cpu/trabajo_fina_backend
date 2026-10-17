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

  /**
   * POST /api/notificaciones/cumpleanos -> lote simulado (RF-VEN-15).
   * A diferencia de `crear`, aqui no hay Location: el recurso creado
   * es un conjunto de filas y el resumen del lote va en `datos`.
   */
  notificarCumpleanos = capturarAsync(async (req, res) => {
    const { destinatarios, fecha } = await notificacionService.notificarCumpleanos();

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      // Sin id unico: el lote toca muchas filas; el resumen queda en
      // el detalle de bitacora y en el log del servidor.
      idRegistro: null,
      detalle: `Lote de cumpleanos ${fecha}: ${destinatarios} notificaciones simuladas`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Envio de cumpleanos'),
      datos: { destinatarios, fecha }
    });
  });
}

// Singleton.
module.exports = new NotificacionController();
