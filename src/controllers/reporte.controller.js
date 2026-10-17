/**
 * src/controllers/reporte.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> ReporteService. Los reportes son SOLO de lectura: no hay
 * bitacora (no modifican tablas).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const reporteService = require('../services/reporte.service');
const { capturarAsync } = require('../middleware/errorHandler');

class ReporteController {
  /** GET /api/reportes/top-clientes?tipo=vip|general (RF-DES-01/02) */
  topClientes = capturarAsync(async (req, res) => {
    const reporte = await reporteService.topClientes(req.query.tipo);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA(`Top de clientes ${reporte.tipo}`),
      datos: reporte
    });
  });
}

// Singleton.
module.exports = new ReporteController();
