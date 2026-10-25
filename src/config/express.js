/**
 * src/config/express.js
 * ---------------------------------------------------------------------
 * Construye y configura la aplicacion Express.
 *
 * POR QUE SEPARAR ESTO DE index.js?
 * Porque asi la aplicacion se puede CREAR sin ARRANCAR el servidor.
 * Eso es lo que permite escribir pruebas automatizadas: el test
 * importa la app y le manda peticiones falsas, sin ocupar el puerto
 * 3000 ni necesitar que nadie levante nada.
 *
 *   config/express.js -> crea la app  (QUE hace la aplicacion)
 *   src/index.js      -> la enciende  (CUANDO y DONDE escucha)
 *
 * EL ORDEN DE LOS app.use() ES CRITICO
 * Express ejecuta los middlewares en el ORDEN EN QUE SE REGISTRAN.
 * Este archivo esta escrito de arriba hacia abajo siguiendo el viaje
 * real de una peticion:
 *
 *   1. CORS            -> permiso del navegador
 *   2. express.json()  -> convertir el cuerpo JSON en objeto
 *   3. logger          -> registrar la peticion
 *   4. rutas           -> atender la peticion
 *   5. raiz            -> saludo en /
 *   6. 404             -> ninguna ruta coincidio
 *   7. errores         -> SIEMPRE el ultimo
 *
 * Si el logger estuviera antes de express.json(), no podria mostrar el
 * cuerpo porque todavia no existiria. Si el manejador de errores
 * estuviera antes de las rutas, nunca atraparia nada.
 */

const express = require('express');
const cors = require('cors');

const config = require('./env');
const rutas = require('../routes');
const { registrarPeticion } = require('../middleware/logger');
const { rutaNoEncontrada, manejadorErrores } = require('../middleware/errorHandler');

/**
 * Crea la aplicacion Express completamente configurada.
 *
 * @returns {import('express').Express}
 */
function crearAplicacion() {
  const app = express();

  // -------------------------------------------------------------------
  // 1. CONFIGURACION BASICA
  // -------------------------------------------------------------------

  // Oculta la cabecera "X-Powered-By: Express".
  // Decirle al mundo que framework usas solo le ahorra trabajo a quien
  // busca vulnerabilidades conocidas.
  app.disable('x-powered-by');

  // -------------------------------------------------------------------
  // 2. CORS (Cross-Origin Resource Sharing)
  // -------------------------------------------------------------------
  //
  // QUE PROBLEMA RESUELVE?
  // Por seguridad, el navegador bloquea las peticiones de JavaScript
  // hacia un ORIGEN distinto al de la pagina. Un origen es la terna
  // protocolo + dominio + puerto.
  //
  // Nuestro frontend corre en  http://localhost:5500
  // Nuestra API corre en       http://localhost:3000
  //                                              ^^^^ puerto distinto
  //                                              = origen distinto
  //
  // Sin CORS, el fetch del frontend falla con el error
  // "blocked by CORS policy", aunque la API responda perfecto.
  // CORS es el servidor diciendo: "autorizo a este origen".
  //
  // IMPORTANTE: NO usamos origin: '*' aunque sea mas facil. Hay que
  // declarar los origenes permitidos (vienen de .env). Una API abierta
  // a cualquier origen puede ser consumida por cualquier sitio web.
  app.use(
    cors({
      origin: config.origenesPermitidos,

      // Verbos HTTP que aceptamos.
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

      // Cabeceras que el cliente puede enviar.
      allowedHeaders: ['Content-Type', 'Accept'],

      // Cabeceras que el navegador puede LEER de la respuesta.
      // Sin esto, el frontend no puede leer la cabecera Location que
      // devolvemos al crear un recurso.
      exposedHeaders: ['Location'],

      // Cuanto tiempo (segundos) puede el navegador cachear el permiso
      // de la peticion previa OPTIONS. Ahorra viajes de ida y vuelta.
      maxAge: 86400
    })
  );

  // -------------------------------------------------------------------
  // 3. LECTURA DEL CUERPO DE LA PETICION
  // -------------------------------------------------------------------

  // express.json() lee el cuerpo, lo interpreta como JSON y lo deja en
  // req.body. Sin este middleware, req.body seria undefined.
  //
  // El limite de 100kb protege contra peticiones gigantes. Para esta
  // API un cuerpo nunca pasa de unos kilobytes.
  app.use(express.json({ limit: '100kb' }));

  // Lee los formularios HTML clasicos (application/x-www-form-urlencoded).
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // -------------------------------------------------------------------
  // 4. REGISTRO DE PETICIONES (logging)
  // -------------------------------------------------------------------
  app.use(registrarPeticion);

  // -------------------------------------------------------------------
  // 5. RUTAS DE LA API
  // -------------------------------------------------------------------

  // Todo el enrutador principal se monta bajo el prefijo /api.
  app.use('/api', rutas);

  // Ruta raiz: un saludo que orienta a quien abre el servidor en el
  // navegador y no sabe por donde empezar.
  app.get('/', (req, res) => {
    res.json({
      ok: true,
      mensaje: 'Bienvenido a discoteca-api. La documentacion de recursos esta en /api',
      datos: {
        documentacion: '/api',
        estadoSalud: '/api/salud'
      }
    });
  });

  // -------------------------------------------------------------------
  // 6. MANEJO DE ERRORES (SIEMPRE AL FINAL)
  // -------------------------------------------------------------------

  // Si la peticion llego hasta aqui, ninguna ruta coincidio -> 404.
  app.use(rutaNoEncontrada);

  // Middleware de errores. Debe ser el ULTIMO app.use() y tener
  // CUATRO parametros (err, req, res, next); si tiene tres, Express
  // lo trata como un middleware normal y nunca se activa.
  app.use(manejadorErrores);

  return app;
}

module.exports = { crearAplicacion };
