/**
 * src/controllers/categoria-empleado.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> CategoriaEmpleadoService. Bitacora en cada mutacion (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const categoriaEmpleadoService = require('../services/categoria-empleado.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'categoria_empleado';

class CategoriaEmpleadoController {
  /** GET /api/categorias/empleados */
  listar = capturarAsync(async (req, res) => {
    const { categorias, total, pagina, limite } = await categoriaEmpleadoService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('categorias de empleado'),
      datos: categorias,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: categorias.length })
    });
  });

  /** GET /api/categorias/empleados/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const categoria = await categoriaEmpleadoService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Categoria de empleado'),
      datos: categoria
    });
  });

  /** POST /api/categorias/empleados -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const categoria = await categoriaEmpleadoService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: categoria.id,
      detalle: `Categoria de empleado "${categoria.nombre}" creada`
    });

    res.set('Location', `/api/categorias/empleados/${categoria.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Categoria de empleado'),
      datos: categoria
    });
  });

  /** PUT /api/categorias/empleados/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const categoria = await categoriaEmpleadoService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Categoria de empleado "${categoria.nombre}" actualizada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Categoria de empleado'),
      datos: categoria
    });
  });

  /** PATCH /api/categorias/empleados/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const categoria = await categoriaEmpleadoService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado de la categoria "${categoria.nombre}": ahora "${categoria.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: categoria
    });
  });

  /** DELETE /api/categorias/empleados/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const categoria = await categoriaEmpleadoService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Categoria de empleado "${categoria.nombre}" eliminada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Categoria de empleado'),
      datos: categoria
    });
  });
}

// Singleton.
module.exports = new CategoriaEmpleadoController();
