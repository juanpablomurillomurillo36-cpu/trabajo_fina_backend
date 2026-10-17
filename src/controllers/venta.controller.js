/**
 * src/controllers/venta.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> VentaService. Bitacora en cada mutacion (C8).
 * Las lecturas devuelven la venta CON sus lineas (composicion).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const ventaService = require('../services/venta.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'ventas';

class VentaController {
  /** GET /api/ventas */
  listar = capturarAsync(async (req, res) => {
    const { ventas, total, pagina, limite } = await ventaService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('ventas'),
      datos: ventas,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: ventas.length })
    });
  });

  /** GET /api/ventas/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const venta = await ventaService.obtenerConDetalles(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Venta'),
      datos: venta
    });
  });

  /** POST /api/ventas -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const venta = await ventaService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: venta.id,
      detalle: `Venta #${venta.id} por ${venta.total} al cliente #${venta.idCliente} creada`
    });

    res.set('Location', `/api/ventas/${venta.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Venta'),
      datos: venta
    });
  });

  /** PUT /api/ventas/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const venta = await ventaService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Venta #${id} editada: total ${venta.total}`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Venta'),
      datos: venta
    });
  });

  /** POST /api/ventas/:id/pagar (RN-09/RN-10) */
  pagar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const venta = await ventaService.pagar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Venta #${id} PAGADA: total ${venta.total}, comprobante ${venta.comprobanteNo}`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.VENTA_PAGADA,
      datos: venta
    });
  });

  /** POST /api/ventas/:id/anular (RN-09) */
  anular = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const venta = await ventaService.anular(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Venta #${id} anulada (estado "${venta.estado}")`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Anulacion de venta'),
      datos: venta
    });
  });

  /** DELETE /api/ventas/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const venta = await ventaService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Venta #${id} eliminada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Venta'),
      datos: venta
    });
  });
}

// Singleton.
module.exports = new VentaController();
