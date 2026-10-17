/**
 * src/controllers/producto.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> ProductoService. Sin reglas de negocio ni SQL.
 * Cada mutacion registra su evento en la bitacora (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const productoService = require('../services/producto.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'productos';

class ProductoController {
  /** GET /api/productos */
  listar = capturarAsync(async (req, res) => {
    const { productos, total, pagina, limite } = await productoService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('productos'),
      datos: productos,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: productos.length })
    });
  });

  /** GET /api/productos/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const producto = await productoService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Producto'),
      datos: producto
    });
  });

  /** POST /api/productos -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const producto = await productoService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: producto.id,
      detalle: `Producto "${producto.nombre}" creado`
    });

    res.set('Location', `/api/productos/${producto.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Producto'),
      datos: producto
    });
  });

  /** PUT /api/productos/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const producto = await productoService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Producto "${producto.nombre}" actualizado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Producto'),
      datos: producto
    });
  });

  /** PATCH /api/productos/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const producto = await productoService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado del producto "${producto.nombre}": ahora "${producto.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: producto
    });
  });

  /** DELETE /api/productos/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const producto = await productoService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Producto "${producto.nombre}" eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Producto'),
      datos: producto
    });
  });
}

// Singleton.
module.exports = new ProductoController();
