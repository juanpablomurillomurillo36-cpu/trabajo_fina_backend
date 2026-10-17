/**
 * src/controllers/servicio.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> ServicioService. Bitacora en cada mutacion (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const servicioService = require('../services/servicio.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'servicios';

class ServicioController {
  /** GET /api/servicios */
  listar = capturarAsync(async (req, res) => {
    const { servicios, total, pagina, limite } = await servicioService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('servicios'),
      datos: servicios,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: servicios.length })
    });
  });

  /** GET /api/servicios/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const servicio = await servicioService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Servicio'),
      datos: servicio
    });
  });

  /** POST /api/servicios -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const servicio = await servicioService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: servicio.id,
      detalle: `Servicio "${servicio.nombre}" creado`
    });

    res.set('Location', `/api/servicios/${servicio.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Servicio'),
      datos: servicio
    });
  });

  /** PUT /api/servicios/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const servicio = await servicioService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Servicio "${servicio.nombre}" actualizado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Servicio'),
      datos: servicio
    });
  });

  /** PATCH /api/servicios/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const servicio = await servicioService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado del servicio "${servicio.nombre}": ahora "${servicio.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: servicio
    });
  });

  /** DELETE /api/servicios/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const servicio = await servicioService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Servicio "${servicio.nombre}" eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Servicio'),
      datos: servicio
    });
  });
}

// Singleton.
module.exports = new ServicioController();
