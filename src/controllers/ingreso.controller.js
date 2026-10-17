/**
 * src/controllers/ingreso.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> IngresoService. Bitacora en la validacion (C8): quien
 * autorizo la entrada queda registrado.
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const ingresoService = require('../services/ingreso.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'ingresos';

class IngresoController {
  /** GET /api/ingresos */
  listar = capturarAsync(async (req, res) => {
    const { ingresos, total, pagina, limite } = await ingresoService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('ingresos'),
      datos: ingresos,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: ingresos.length })
    });
  });

  /** GET /api/ingresos/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const ingreso = await ingresoService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Ingreso'),
      datos: ingreso
    });
  });

  /** POST /api/ingresos/validar -> 201 + Location */
  validar = capturarAsync(async (req, res) => {
    const ingreso = await ingresoService.validar(req.body, req.usuario.id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: ingreso.id,
      detalle: `QR ${ingreso.codigoQr} validado en ${ingreso.puertaAcceso} (cliente #${ingreso.idCliente})`
    });

    res.set('Location', `/api/ingresos/${ingreso.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Ingreso'),
      datos: ingreso
    });
  });
}

// Singleton.
module.exports = new IngresoController();
