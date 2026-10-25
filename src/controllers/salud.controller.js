/**
 * src/controllers/salud.controller.js
 * ---------------------------------------------------------------------
 * CONTROLADOR del endpoint de SALUD (health check).
 *
 * QUE ES UN HEALTH CHECK?
 * Un endpoint barato que responde "estoy vivo y conectado". Lo usan:
 *
 *   - los balanceadores de carga de produccion, para decidir si
 *     mandan trafico a este servidor o a otro;
 *   - Docker / Kubernetes en su verificacion de arranque;
 *   - y nosotros mismos, para comprobar en 2 segundos que la API y
 *     MySQL estan respondiendo antes de abrir Postman.
 *
 * No consulta ninguna tabla de negocio a proposito: tiene que ser
 * rapidisimo y no debe fallar aunque este toda la base saturada.
 *
 * MANEJO DE ERRORES: try/catch propio. Si MySQL esta caido,
 * verificarConexion() lanza y el catch hace next(error), con lo que
 * el middleware de errores responde 500 con un mensaje claro.
 */

const db = require('../config/database');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const { ahoraISO } = require('../utils/fechas');

class SaludController {
  /**
   * GET /api/salud
   */
  verificar = async (req, res, next) => {
    try {
      await db.verificarConexion();

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.CONSULTA_EXITOSA,
        datos: {
          api: 'activa',
          baseDatos: db.estaConectada ? 'conectada' : 'desconectada',

          // process.uptime() son los segundos que lleva corriendo el
          // proceso de Node. Sirve para detectar reinicios inesperados.
          tiempoActivoSegundos: Math.floor(process.uptime()),
          marcaTiempo: ahoraISO()
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new SaludController();
