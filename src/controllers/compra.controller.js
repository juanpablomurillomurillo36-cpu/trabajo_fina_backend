/**
 * src/controllers/compra.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> CompraService. Bitacora en cada mutacion (C8).
 * El detalle NO tiene controller propio: viaja dentro de la compra
 * (composicion P4).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const compraService = require('../services/compra.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'compras';

class CompraController {
  /** GET /api/compras */
  listar = capturarAsync(async (req, res) => {
    const { compras, total, pagina, limite } = await compraService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('compras'),
      datos: compras,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: compras.length })
    });
  });

  /** GET /api/compras/:id (incluye detalles) */
  obtenerPorId = capturarAsync(async (req, res) => {
    const compra = await compraService.obtenerConDetalles(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Compra'),
      datos: compra
    });
  });

  /** POST /api/compras -> 201 + Location (transaccion compra+detalles) */
  crear = capturarAsync(async (req, res) => {
    const compra = await compraService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: compra.id,
      detalle: `Compra #${compra.id} al proveedor "${compra.nombreProveedor}" por ${compra.total} con ${compra.detalles.length} linea(s)`
    });

    res.set('Location', `/api/compras/${compra.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Compra'),
      datos: compra
    });
  });

  /** PUT /api/compras/:id (solo pendiente) */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const compra = await compraService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Compra #${id} editada: total ${compra.total}, ${compra.detalles.length} linea(s)`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Compra'),
      datos: compra
    });
  });

  /** DELETE /api/compras/:id (solo pendiente) */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const compra = await compraService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Compra #${id} al proveedor "${compra.nombreProveedor}" eliminada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Compra'),
      datos: compra
    });
  });

  /** POST /api/compras/:id/confirmar (RN-01: suma stock en transaccion) */
  confirmar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const compra = await compraService.confirmar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Compra #${id} confirmada: stock actualizado en ${compra.detalles.length} producto(s)`
    });

    return respuesta.exito(res, {
      mensaje: 'Compra confirmada y stock actualizado',
      datos: compra
    });
  });

  /** POST /api/compras/:id/cancelar (queda anulada sin tocar stock) */
  cancelar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const compra = await compraService.cancelar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Compra #${id} cancelada`
    });

    return respuesta.exito(res, {
      mensaje: 'Compra cancelada correctamente',
      datos: compra
    });
  });
}

// Singleton.
module.exports = new CompraController();
