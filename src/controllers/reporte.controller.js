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

  /** GET /api/reportes/servicios-solicitados (RF-DES-03/04) */
  serviciosSolicitados = capturarAsync(async (req, res) => {
    const reporte = await reporteService.serviciosSolicitados();

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('Servicios solicitados'),
      datos: reporte
    });
  });

  /** GET /api/reportes/productos-menos-vendidos (RF-DES-05) */
  productosMenosVendidos = capturarAsync(async (req, res) => {
    const reporte = await reporteService.productosMenosVendidos();

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('Top 3 de productos menos vendidos'),
      datos: reporte
    });
  });

  /** GET /api/reportes/ventas-por-mes?anio= (RF-DES-06) */
  ventasPorMes = capturarAsync(async (req, res) => {
    const reporte = await reporteService.ventasPorMes(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('Ventas mes a mes'),
      datos: reporte
    });
  });

  /** GET /api/reportes/ventas-mayor-menor (RF-DES-07/08) */
  ventasMayorMenor = capturarAsync(async (req, res) => {
    const reporte = await reporteService.mayorMenorVentas();

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Ventas de mayor y menor dia/mes'),
      datos: reporte
    });
  });

  /** GET /api/reportes/ventas-subtotales (RF-DES-09) */
  ventasSubtotales = capturarAsync(async (req, res) => {
    const reporte = await reporteService.ventasSubtotales();

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('Subtotales mensuales de ventas'),
      datos: reporte
    });
  });
}

// Singleton.
module.exports = new ReporteController();
