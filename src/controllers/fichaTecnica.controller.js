/**
 * src/controllers/fichaTecnica.controller.js
 * ---------------------------------------------------------------------
 * HTTP de la ficha tecnica ANIDADA en el evento
 * (/api/eventos/:id/ficha). La capa solo traduce: la logica vive en
 * FichaTecnicaService.
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const fichaTecnicaService = require('../services/ficha-tecnica.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'ficha_tecnica';

class FichaTecnicaController {
  /** GET /api/eventos/:id/ficha */
  obtener = capturarAsync(async (req, res) => {
    const ficha = await fichaTecnicaService.obtenerPorEvento(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Ficha tecnica'),
      datos: ficha
    });
  });

  /** POST /api/eventos/:id/ficha -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const idEvento = req.idsValidados.id;
    const ficha = await fichaTecnicaService.crear(idEvento, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: ficha.id,
      detalle: `Ficha tecnica del evento #${idEvento} creada (${ficha.servicios.length} servicios)`
    });

    res.set('Location', `/api/eventos/${idEvento}/ficha`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Ficha tecnica'),
      datos: ficha
    });
  });

  /** PUT /api/eventos/:id/ficha */
  actualizar = capturarAsync(async (req, res) => {
    const idEvento = req.idsValidados.id;
    const ficha = await fichaTecnicaService.actualizar(idEvento, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: ficha.id,
      detalle: `Ficha tecnica del evento #${idEvento} editada (${ficha.servicios.length} servicios)`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Ficha tecnica'),
      datos: ficha
    });
  });

  /** DELETE /api/eventos/:id/ficha */
  eliminar = capturarAsync(async (req, res) => {
    const idEvento = req.idsValidados.id;
    const ficha = await fichaTecnicaService.eliminar(idEvento);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: ficha.id,
      detalle: `Ficha tecnica del evento #${idEvento} eliminada`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Ficha tecnica'),
      datos: ficha
    });
  });
}

// Singleton.
module.exports = new FichaTecnicaController();
