/**
 * src/controllers/categoria-cliente.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> CategoriaClienteService. Bitacora en cada mutacion (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const categoriaClienteService = require('../services/categoria-cliente.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'categoria_clientes';

class CategoriaClienteController {
  /** GET /api/categorias/clientes */
  listar = capturarAsync(async (req, res) => {
    const { categorias, total, pagina, limite } = await categoriaClienteService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('categorias de cliente'),
      datos: categorias,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: categorias.length })
    });
  });

  /** GET /api/categorias/clientes/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const categoria = await categoriaClienteService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Categoria de cliente'),
      datos: categoria
    });
  });

  /** POST /api/categorias/clientes -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const categoria = await categoriaClienteService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: categoria.id,
      detalle: `Categoria de cliente "${categoria.nombre}" creada`
    });

    res.set('Location', `/api/categorias/clientes/${categoria.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Categoria de cliente'),
      datos: categoria
    });
  });

  /** PUT /api/categorias/clientes/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const categoria = await categoriaClienteService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Categoria de cliente "${categoria.nombre}" actualizada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Categoria de cliente'),
      datos: categoria
    });
  });

  /** PATCH /api/categorias/clientes/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const categoria = await categoriaClienteService.cambiarEstado(id, req.body);

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

  /** DELETE /api/categorias/clientes/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const categoria = await categoriaClienteService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Categoria de cliente "${categoria.nombre}" eliminada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Categoria de cliente'),
      datos: categoria
    });
  });
}

// Singleton.
module.exports = new CategoriaClienteController();
