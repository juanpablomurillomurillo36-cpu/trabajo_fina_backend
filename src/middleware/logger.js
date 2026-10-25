/**
 * src/middleware/logger.js
 * ---------------------------------------------------------------------
 * Middleware que registra en consola cada peticion que llega.
 *
 * QUE ES UN MIDDLEWARE?
 * Es una funcion con la firma (req, res, next) que Express ejecuta en
 * cadena, en el orden en que se registra con app.use().
 *
 *   peticion -> [cors] -> [json] -> [logger] -> [rutas] -> [errores] -> respuesta
 *
 *   req  = la peticion entrante  (lo que envia el cliente)
 *   res  = la respuesta saliente (lo que devolvemos)
 *   next = funcion para pasar el control al SIGUIENTE middleware
 *
 * Si un middleware no llama a next() ni responde, la peticion se queda
 * colgada para siempre. Es el error mas comun al empezar con Express.
 *
 * POR QUE REGISTRAR LAS PETICIONES?
 * Cuando algo falla, lo primero que pregunta cualquier instructor es
 * "que llego y que salio". Sin log, la unica forma de saberlo es
 * reproducir el caso a mano. Aqui queda impreso metodo, URL, estado,
 * duracion y (en desarrollo) el cuerpo.
 */

const { ahoraISO } = require('../utils/fechas');
const config = require('../config/env');

// Codigos de color ANSI para la terminal. Hacen el log mas legible.
// \x1b[ es el caracter de escape; 0m devuelve el color a la normalidad.
const COLOR = {
  reinicio: '\x1b[0m',
  gris: '\x1b[90m',
  verde: '\x1b[32m',
  amarillo: '\x1b[33m',
  rojo: '\x1b[31m',
  azul: '\x1b[34m',
  cian: '\x1b[36m'
};

/**
 * Elige el color segun el NIVEL del mensaje.
 * info = verde, aviso = amarillo, error = rojo.
 */
function colorPorNivel(nivel) {
  switch (nivel) {
    case 'error':
      return COLOR.rojo;
    case 'aviso':
      return COLOR.amarillo;
    default:
      return COLOR.verde;
  }
}

/**
 * Elige el color segun el codigo HTTP de la respuesta.
 * 2xx verde, 3xx cian, 4xx amarillo, 5xx rojo.
 *
 * @param {number} estado
 * @returns {string}
 */
function colorPorEstado(estado) {
  if (estado >= 500) return COLOR.rojo;
  if (estado >= 400) return COLOR.amarillo;
  if (estado >= 300) return COLOR.cian;
  return COLOR.verde;
}

/**
 * Escribe una linea de log con el formato:
 *
 *   [2026-10-24T21:30:00.000Z] INFO  SERVIDOR_INICIADO {"puerto":3000}
 *
 * `datos` viaja en JSON porque en una terminal una busqueda por texto
 * ("donde aparecio DB_NO_DISPONIBLE") devuelve TODAS las lineas de
 * ese evento con su contexto.
 *
 * @param {string} nivel   'info' | 'aviso' | 'error'
 * @param {string} codigo  Nombre corto y estable del evento.
 * @param {object} datos   Contexto adicional.
 */
function registrar(nivel = 'info', codigo = 'EVENTO', datos = {}) {
  const color = colorPorNivel(nivel);
  const texto = Object.keys(datos).length > 0 ? ` ${JSON.stringify(datos)}` : '';

  console.log(
    `${COLOR.gris}[${ahoraISO()}]${COLOR.reinicio} ` +
      `${color}${nivel.toUpperCase().padEnd(5)}${COLOR.reinicio} ` +
      `${codigo}${texto}`
  );
}

/** Atajo: registro de nivel info. */
function registrarInfo(codigo, datos = {}) {
  registrar('info', codigo, datos);
}

/** Atajo: registro de nivel aviso (algo no fatal). */
function registrarAviso(codigo, datos = {}) {
  registrar('aviso', codigo, datos);
}

/**
 * Atajo: registro de nivel error.
 * Se usa para fallos de base de datos, promesas rechazadas y
 * excepciones no atrapadas en index.js.
 *
 * @param {string} codigo
 * @param {object} datos
 */
function registrarError(codigo, datos = {}) {
  registrar('error', codigo, datos);
}

/**
 * Middleware de registro de peticiones.
 *
 * Truco clave: medimos el tiempo de respuesta escuchando el evento
 * 'finish' del objeto res. Ese evento se dispara cuando Express ya
 * envio la respuesta completa, que es el unico momento en que
 * conocemos el codigo de estado final.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {function} next
 */
function registrarPeticion(req, res, next) {
  // process.hrtime.bigint() da nanosegundos con alta precision.
  // Date.now() solo da milisegundos y no sirve para medir rutas rapidas.
  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const fin = process.hrtime.bigint();

    // De nanosegundos a milisegundos: dividimos entre un millon.
    const duracionMs = Number(fin - inicio) / 1_000_000;

    const color = colorPorEstado(res.statusCode);

    // req.originalUrl incluye la query string (?pagina=2).
    // req.method es GET, POST, PUT, PATCH, DELETE...
    console.log(
      `${COLOR.gris}[${ahoraISO()}]${COLOR.reinicio} ` +
        `${COLOR.azul}${req.method.padEnd(6)}${COLOR.reinicio} ` +
        `${req.originalUrl} ` +
        `${color}${res.statusCode}${COLOR.reinicio} ` +
        `${COLOR.gris}${duracionMs.toFixed(1)} ms${COLOR.reinicio}`
    );
  });

  // En desarrollo mostramos tambien el cuerpo de la peticion.
  // En produccion NO, porque podria contener una contrasena.
  if (config.esDesarrollo && req.body && Object.keys(req.body).length > 0) {
    const copia = { ...req.body };

    // Nunca se imprime una contrasena, ni siquiera en desarrollo:
    // los logs se pegan en foros y en correos tecnicos.
    if ('contrasena' in copia) copia.contrasena = '***';

    console.log(`${COLOR.gris}   cuerpo:${COLOR.reinicio}`, JSON.stringify(copia));
  }

  // Pasamos el control al siguiente middleware de la cadena.
  next();
}

module.exports = { registrar, registrarInfo, registrarAviso, registrarError, registrarPeticion, COLOR };
