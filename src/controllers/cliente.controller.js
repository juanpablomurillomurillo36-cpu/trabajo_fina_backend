/**
 * src/controllers/cliente.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> ClienteService. Bitacora en cada mutacion (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const clienteService = require('../services/cliente.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'clientes';

class ClienteController {
  /** GET /api/clientes */
  listar = capturarAsync(async (req, res) => {
    const { clientes, total, pagina, limite } = await clienteService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('clientes'),
      datos: clientes,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: clientes.length })
    });
  });

  /** GET /api/clientes/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const cliente = await clienteService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Cliente'),
      datos: cliente
    });
  });

  /** POST /api/clientes -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const cliente = await clienteService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: cliente.id,
      detalle: `Cliente ${cliente.nombre} ${cliente.apellido} (${cliente.documento}) creado`
    });

    res.set('Location', `/api/clientes/${cliente.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Cliente'),
      datos: cliente
    });
  });

  /** PUT /api/clientes/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const cliente = await clienteService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Cliente ${cliente.nombre} ${cliente.apellido} (${cliente.documento}) actualizado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Cliente'),
      datos: cliente
    });
  });

  /** PATCH /api/clientes/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const cliente = await clienteService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado del cliente ${cliente.documento}: ahora "${cliente.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: cliente
    });
  });

  /** DELETE /api/clientes/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const cliente = await clienteService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Cliente ${cliente.nombre} ${cliente.apellido} (${cliente.documento}) eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Cliente'),
      datos: cliente
    });
  });
}

// Singleton.
module.exports = new ClienteController();
