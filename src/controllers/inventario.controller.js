/**
 * src/controllers/inventario.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> InventarioService (alertas de stock, RN-03).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const inventarioService = require('../services/inventario.service');
const { capturarAsync } = require('../middleware/errorHandler');

class InventarioController {
  /** GET /api/inventario/alertas */
  alertas = capturarAsync(async (req, res) => {
    const { productos, total, mensajeLog } = await inventarioService.alertasDeStock();

    return respuesta.exito(res, {
      mensaje: total > 0
        ? `Hay ${total} producto(s) por debajo del stock minimo`
        : 'Sin alertas de stock minimo',
      datos: productos,
      meta: {
        total,
        alertaActiva: total > 0,
        registroLog: mensajeLog
      }
    });
  });
}

// Singleton.
module.exports = new InventarioController();
