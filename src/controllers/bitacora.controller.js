/**
 * src/controllers/bitacora.controller.js
 * ---------------------------------------------------------------------
 * CAPA DE CONTROLADOR de la bitacora (auditoria de datos).
 *
 * Solo expone la LECTURA: escribir en la bitacora lo hacen los demas
 * controladores tras cada cambio (ver bitacoraService.registrarDesdeReq).
 *
 * TABLA DE ENDPOINTS (tambien esta en routes/bitacora.routes.js)
 *   GET /api/bitacora                    Listado con filtros y paginacion
 *   GET /api/bitacora/:tabla/:idRegistro Historial de UN registro
 */

const bitacoraService = require('../services/bitacora.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const { capturarAsync } = require('../middleware/errorHandler');

class BitacoraController {
  /** GET /api/bitacora */
  listar = capturarAsync(async (req, res) => {
    const { eventos, total, pagina, limite } = await bitacoraService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('eventos de bitacora'),
      datos: eventos,
      meta: respuesta.construirMeta({
        total,
        pagina,
        limite,
        devueltos: eventos.length
      })
    });
  });

  /** GET /api/bitacora/:tabla/:idRegistro */
  listarDeRegistro = capturarAsync(async (req, res) => {
    const eventos = await bitacoraService.listarDeRegistro(
      req.params.tabla,
      req.idsValidados.idRegistro
    );

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA(`eventos de ${req.params.tabla} ${req.idsValidados.idRegistro}`),
      datos: eventos
    });
  });
}

// SINGLETON
module.exports = new BitacoraController();
