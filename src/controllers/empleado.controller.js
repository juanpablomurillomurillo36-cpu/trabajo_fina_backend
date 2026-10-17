/**
 * src/controllers/empleado.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> EmpleadoService. Bitacora en cada mutacion (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const empleadoService = require('../services/empleado.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'empleados';

class EmpleadoController {
  /** GET /api/empleados */
  listar = capturarAsync(async (req, res) => {
    const { empleados, total, pagina, limite } = await empleadoService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('empleados'),
      datos: empleados,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: empleados.length })
    });
  });

  /** GET /api/empleados/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const empleado = await empleadoService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Empleado'),
      datos: empleado
    });
  });

  /** POST /api/empleados -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const empleado = await empleadoService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: empleado.id,
      detalle: `Empleado ${empleado.nombre} ${empleado.apellido} (${empleado.documento}) creado`
    });

    res.set('Location', `/api/empleados/${empleado.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Empleado'),
      datos: empleado
    });
  });

  /** PUT /api/empleados/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const empleado = await empleadoService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Empleado ${empleado.nombre} ${empleado.apellido} (${empleado.documento}) actualizado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Empleado'),
      datos: empleado
    });
  });

  /** PATCH /api/empleados/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const empleado = await empleadoService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado del empleado ${empleado.documento}: ahora "${empleado.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: empleado
    });
  });

  /** DELETE /api/empleados/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const empleado = await empleadoService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Empleado ${empleado.nombre} ${empleado.apellido} (${empleado.documento}) eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Empleado'),
      datos: empleado
    });
  });
}

// Singleton.
module.exports = new EmpleadoController();
