/**
 * src/controllers/reserva.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> ReservaService. Bitacora en cada mutacion (C8).
 * Las lecturas devuelven la reserva CON sus lineas: es una composicion.
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const reservaService = require('../services/reserva.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'reservas';

class ReservaController {
  /** GET /api/reservas */
  listar = capturarAsync(async (req, res) => {
    const { reservas, total, pagina, limite } = await reservaService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('reservas'),
      datos: reservas,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: reservas.length })
    });
  });

  /** GET /api/reservas/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const reserva = await reservaService.obtenerConDetalles(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Reserva'),
      datos: reserva
    });
  });

  /** POST /api/reservas -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const reserva = await reservaService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: reserva.id,
      detalle: `Reserva ${reserva.identificadorEspacio} ${reserva.fecha} ${reserva.hora} creada`
    });

    res.set('Location', `/api/reservas/${reserva.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Reserva'),
      datos: reserva
    });
  });

  /** PUT /api/reservas/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const reserva = await reservaService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Reserva #${id} editada: ${reserva.identificadorEspacio} ${reserva.fecha}`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Reserva'),
      datos: reserva
    });
  });

  /** PATCH /api/reservas/:id/estado  (confirmar o cancelar) */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const reserva = await reservaService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado de la reserva #${id}: ahora "${reserva.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: reserva
    });
  });

  /** POST /api/reservas/:id/qr  (codigo unico + imagen QR) */
  generarQr = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const { codigo, imagen, generado } = await reservaService.generarQr(id);

    // Solo bitacora cuando AQUI nacio el codigo (la confirmacion ya
    // dejo su propio registro al cambiar de estado).
    if (generado) {
      await bitacoraService.registrarDesdeReq(req, {
        tabla: TABLA,
        accion: ACCION_BITACORA.EDICION,
        idRegistro: id,
        detalle: `Codigo QR ${codigo} generado para la reserva #${id}`
      });
    }

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Generacion del codigo QR'),
      datos: { codigo, imagen }
    });
  });

  /** DELETE /api/reservas/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const reserva = await reservaService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Reserva #${id} (${reserva.identificadorEspacio} ${reserva.fecha}) eliminada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Reserva'),
      datos: reserva
    });
  });
}

// Singleton.
module.exports = new ReservaController();
