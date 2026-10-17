/**
 * src/controllers/programa-puntos.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> ProgramaPuntosService. El canje queda registrado en la
 * bitacora (auditoria de movimientos de puntos).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const programaPuntosService = require('../services/programa-puntos.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'programa_puntos';

class ProgramaPuntosController {
  /** GET /api/puntos/:idCliente */
  saldo = capturarAsync(async (req, res) => {
    const programa = await programaPuntosService.saldo(req.idsValidados.idCliente);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Programa de puntos'),
      datos: programa
    });
  });

  /** POST /api/puntos/:idCliente/canjear */
  canjear = capturarAsync(async (req, res) => {
    const idCliente = req.idsValidados.idCliente;
    const programa = await programaPuntosService.canjear(idCliente, req.body?.cantidad);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: programa.id,
      detalle: `Cliente #${idCliente} canjeo ${req.body?.cantidad} puntos (saldo ${programa.saldo})`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Canje de puntos'),
      datos: programa
    });
  });
}

// Singleton.
module.exports = new ProgramaPuntosController();
