/**
 * src/controllers/proveedor.controller.js
 * ---------------------------------------------------------------------
 * Expone HTTP sobre ProveedorService. Aqui NO hay reglas de negocio ni
 * SQL: solo traduccion request -> service -> respuesta.
 *
 * Cada mutacion exitosa deja un evento en la bitacora (C8) llamando a
 * bitacoraService.registrarDesdeReq; si no hay sesion, el service omite
 * el registro.
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const proveedorService = require('../services/proveedor.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'proveedores';

class ProveedorController {
  /** GET /api/proveedores */
  listar = capturarAsync(async (req, res) => {
    const { proveedores, total, pagina, limite } = await proveedorService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('proveedores'),
      datos: proveedores,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: proveedores.length })
    });
  });

  /** GET /api/proveedores/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const proveedor = await proveedorService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Proveedor'),
      datos: proveedor
    });
  });

  /** POST /api/proveedores -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const proveedor = await proveedorService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: proveedor.id,
      detalle: `Proveedor "${proveedor.nombre}" creado`
    });

    res.set('Location', `/api/proveedores/${proveedor.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Proveedor'),
      datos: proveedor
    });
  });

  /** PUT /api/proveedores/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const proveedor = await proveedorService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Proveedor "${proveedor.nombre}" actualizado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Proveedor'),
      datos: proveedor
    });
  });

  /** PATCH /api/proveedores/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const proveedor = await proveedorService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado del proveedor "${proveedor.nombre}": ahora "${proveedor.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: proveedor
    });
  });

  /** DELETE /api/proveedores/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const proveedor = await proveedorService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Proveedor "${proveedor.nombre}" eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Proveedor'),
      datos: proveedor
    });
  });
}

// Singleton.
module.exports = new ProveedorController();
