/**
 * src/controllers/salud.controller.js
 * ---------------------------------------------------------------------
 * Controlador del "health check" (revision de salud) de la API.
 *
 * PARA QUE SIRVE
 *   Es el endpoint que se usa en Postman para comprobar que el
 *   servidor arranco, que el CORS esta bien y que MySQL responde.
 *   Tambien es el primero en entregarse en una demostracion.
 *
 * EL PATRON DE TODOS LOS CONTROLLERS (se repite en todo el proyecto)
 *   1. El metodo es async y NO lleva try/catch: `capturarAsync` se
 *      encarga de derivar cualquier error al manejador central.
 *   2. Solo "toma" de la peticion y "devuelve" una respuesta.
 *   3. Cero SQL y cero reglas de negocio: eso vive en repositories y
 *      services. Este controller solo consulta la salud de la BD.
 */

const db = require('../config/database');
const configuracion = require('../config/env');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const respuesta = require('../utils/respuesta');
const { capturarAsync } = require('../middleware/errorHandler');
const { registrar } = require('../middleware/logger');

// require() de un archivo .json tambien funciona en Node: devuelve el
// objeto parseado. Asi la version sale de package.json y no se
// duplica en el codigo.
const paquete = require('../../package.json');

/**
 * GET /api/salud
 *
 * Respuesta:
 *   {
 *     ok: true,
 *     mensaje: "Servicio funcionando correctamente",
 *     datos: { servicio, version, entorno, baseDeDatos, fecha, tiempoActivo }
 *   }
 *
 * Si MySQL no responde, lanza un AppError 503 (Service Unavailable).
 * Se elige 503 y no 500 porque el servidor ESTA vivo, pero no puede
 * prestar el servicio: es la respuesta correcta para un health check.
 *
 * @param {object} req
 * @param {object} res
 */
async function verificar(req, res) {
  // "SELECT 1" es la consulta mas barata que existe: solo comprueba
  // que la conexion sigue viva sin leer datos.
  try {
    await db.ejecutar('SELECT 1 AS prueba');
  } catch (error) {
    // Guardamos la causa real en el log del servidor (ahi si es util
    // para el programador). Al cliente solo se le avisa que la BD
    // no responde: nunca se filtra host, usuario ni clave.
    registrar('error', 'BASE_DATOS_SIN_RESPUESTA', { causa: error.message });

    throw new AppError(
      MENSAJES.SISTEMA.BASE_DE_DATOS_NO_DISPONIBLE,
      503,
      'E-503'
    );
  }

  return respuesta.exito(res, {
    mensaje: 'Servicio funcionando correctamente',
    datos: {
      servicio: paquete.name,
      version: paquete.version,
      entorno: configuracion.entorno,
      baseDeDatos: 'conectada',
      fecha: new Date().toISOString(),

      // process.uptime() devuelve los segundos desde que arranco el
      // proceso. Sirve para detectar reinicios inesperados.
      tiempoActivo: Math.round(process.uptime())
    }
  });
}

// Exportamos la version ENVUELTA: desde las rutas se llama
// `controlador.verificar` sin tener que recordar capturarAsync.
module.exports = {
  verificar: capturarAsync(verificar)
};
