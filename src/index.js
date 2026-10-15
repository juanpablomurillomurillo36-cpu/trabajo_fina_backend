/**
 * src/index.js
 * ---------------------------------------------------------------------
 * PUNTO DE ENTRADA de la aplicacion. Unicamente el CICLO DE VIDA:
 *
 *   1. Cargar y validar la configuracion (.env).
 *   2. Verificar que MySQL responda.
 *   3. Armar la app (config/express.js) y escuchar en el puerto.
 *   4. Apagado elegante: cerrar el servidor y la base al recibir senales.
 *
 * AQUI NO HAY LOGICA DE NEGOCIO. Si en algun momento este archivo
 * supera unas pocas lineas, es senal de que algo no pertenece aca.
 *
 * ORDEN DE LOS require()
 * ---------------------------------------------------------------------
 *   Se carga env.js PRIMERO y de forma explicita. Ese archivo valida
 *   las variables obligatorias y si falta alguna detiene el proceso
 *   ("fail fast"). Es mejor que el servidor no arranque por falta de
 *   DB_CLAVE, a que arranque y falle con un error confuso en la
 *   primera peticion de un usuario real.
 */

const configuracion = require('./config/env');
const db = require('./config/database');
const { crearAplicacion } = require('./config/express');
const { registrar, registrarError } = require('./middleware/logger');

/**
 * Arranca el servidor.
 *
 * Es `async` porque verificarConexion() es asincrono (R-ASYNC): no
 * queremos escuchar peticiones si la base de datos no responde.
 */
async function arrancar() {
  // ---- Paso 1: comprobar la base de datos ----
  try {
    await db.verificarConexion();
    registrar('info', 'BASE_DE_DATOS_CONECTADA', {
      host: configuracion.baseDatos.host,
      esquema: configuracion.baseDatos.nombre
    });
  } catch (error) {
    // No tiene sentido seguir: sin base de datos la API no puede
    // responder ninguna peticion util.
    registrarError('BASE_DE_DATOS_NO_DISPONIBLE', { causa: error.message });
    process.exit(1);
  }

  // ---- Paso 2: montar la app y escuchar ----
  const app = crearAplicacion();

  // app.listen() devuelve el servidor HTTP de Node (http.Server),
  // que guardamos para poder cerrarlo ordenadamente despues.
  const servidor = app.listen(configuracion.puerto, () => {
    registrar('info', 'SERVIDOR_INICIADO', {
      puerto: configuracion.puerto,
      entorno: configuracion.entorno,
      url: `http://localhost:${configuracion.puerto}/api/salud`,
      origenes: configuracion.origenesPermitidos
    });
  });

  // ---- Paso 3: apagado elegante (graceful shutdown) ----
  //
  // Si se presiona Ctrl+C y el proceso muere de golpe, las conexiones
  // abiertas a MySQL pueden quedar a medias. Con esto:
  //   1. se deja de aceptar peticiones nuevas (servidor.close),
  //   2. se cierra el pool de conexiones (db.cerrar),
  //   3. recien ahi el proceso termina.
  async function apagar(senal) {
    registrar('info', 'APAGADO_SOLICITADO', { senal });

    // El callback de close() se ejecuta cuando terminan las peticiones
    // que ya estaban en curso.
    servidor.close(async () => {
      try {
        await db.cerrar();
        registrar('info', 'SERVIDOR_DETENIDO', {});
        process.exit(0);
      } catch (error) {
        registrarError('ERROR_AL_CERRAR', { causa: error.message });
        process.exit(1);
      }
    });

    // Red de seguridad: si algo se queda colgado, salimos igualmente
    // despues de 10 segundos para no dejar el proceso vivo sin dueño.
    setTimeout(() => {
      registrarError('APAGADO_FORZADO', { motivo: 'se supero el tiempo de espera' });
      process.exit(1);
    }, 10000).unref();
  }

  // SIGINT = Ctrl+C en la terminal. SIGTERM = peticion de terminacion
  // (por ejemplo al apagar el equipo o detener el servicio).
  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));

  // ---- Paso 4: ultimos recursos de diagnostico ----
  //
  // Si una promesa se rechaza y nadie la atrapa, Node podria morir en
  // silencio. Aqui queda registrado en el log (criterio C8).
  process.on('unhandledRejection', (razon) => {
    registrarError('PROMESA_RECHAZADA_NO_ATRAPADA', { razon: String(razon) });
  });

  // Excepcion no atrapada: aqui si hay que detener el proceso, porque
  // el estado de la aplicacion ya no es confiable.
  process.on('uncaughtException', (error) => {
    registrarError('EXCEPCION_NO_ATRAPADA', {
      mensaje: error.message,
      pila: error.stack
    });
    process.exit(1);
  });
}

arrancar();
