/**
 * src/middleware/errorHandler.js
 * ---------------------------------------------------------------------
 * Manejo CENTRALIZADO de errores.
 *
 * La idea: en los services y controllers simplemente lanzamos el error
 * (`throw`). Nadie responde errores a mano. Todos los errores terminan
 * aqui, en un solo lugar, que decide:
 *   - que codigo HTTP responder,
 *   - que mensaje mostrarle al usuario,
 *   - que registrar en el log del servidor.
 *
 * Ventaja: si manana hay que enviar los errores a un sistema de
 * monitoreo (Sentry, por ejemplo), se agrega UNA linea aqui y cubre
 * toda la aplicacion.
 *
 * REGLA DE ORO DE EXPRESS: el middleware de errores tiene CUATRO
 * parametros (err, req, res, next). Si le pones tres, Express lo
 * registra como middleware normal y NUNCA atrapara los errores. Por
 * eso la funcion de abajo tiene el `next` final sin usar.
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const { HTTP, CODIGO_ERROR } = require('../utils/constants');
const respuesta = require('../utils/respuesta');
const config = require('../config/env');
const { COLOR } = require('./logger');

/**
 * Traduce los codigos de error de MySQL a errores de la aplicacion.
 *
 * MySQL devuelve codigos tecnicos como 'ER_DUP_ENTRY' que no se le
 * pueden mostrar a un usuario final. Aqui los convertimos en mensajes
 * entendibles y en el codigo HTTP adecuado.
 *
 * @param {Error} error  Error original del driver mysql2.
 * @returns {AppError|null}  AppError traducido, o null si no era de MySQL.
 */
function traducirErrorMySQL(error) {
  // El driver mysql2 agrega la propiedad `code` a sus errores.
  const codigo = error.code;

  switch (codigo) {
    // Se intento insertar un valor repetido en una llave UNIQUE.
    // Aqui pasa dos veces: nombre_rol unico y email unico. El service
    // ya los detecta antes, pero si dos peticiones llegan a la vez
    // (condicion de carrera) el ultimo en llegar lo atrapa MySQL.
    case 'ER_DUP_ENTRY':
      return AppError.conflicto(
        'El registro ya existe. Revisa los campos que deben ser unicos.'
      );

    // Se referencio un id que no existe en la tabla padre.
    // Ejemplo: crear un usuario con id_rol = 9999.
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return new AppError(
        'El registro referenciado no existe. Verifica los identificadores enviados.',
        HTTP.BAD_REQUEST,
        CODIGO_ERROR.LLAVE_FORANEA
      );

    // Se intento borrar un registro padre que aun tiene hijos.
    // Ejemplo: borrar un rol que todavia tiene usuarios asignados.
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return new AppError(
        'No se puede eliminar el registro porque otros registros dependen de el.',
        HTTP.CONFLICTO,
        CODIGO_ERROR.LLAVE_FORANEA
      );

    // El texto enviado es mas largo que el VARCHAR de la columna.
    case 'ER_DATA_TOO_LONG':
      return AppError.validacion(
        'Uno de los campos supera el tamanio maximo que permite la base de datos.'
      );

    // Se envio null en una columna NOT NULL.
    case 'ER_BAD_NULL_ERROR':
      return AppError.validacion('Falta un campo obligatorio requerido por la base de datos.');

    // Columna ENUM con un valor que no esta en la lista.
    case 'ER_WRONG_VALUE_FOR_COLUMN':
    case 'ER_TRUNCATED_WRONG_VALUE':
      return AppError.validacion('Uno de los valores enviados no esta permitido por la base de datos.');

    // El servidor MySQL esta apagado o no acepta conexiones.
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_CON_COUNT_ERROR':
      return AppError.baseDatos(
        'No se pudo conectar con la base de datos. Verifica que MySQL este encendido.'
      );

    // Usuario o clave incorrectos en el archivo .env
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_BAD_DB_ERROR':
      return AppError.baseDatos(
        'Credenciales de base de datos incorrectas. Revisa DB_USUARIO, DB_CLAVE y DB_NOMBRE en src/.env'
      );

    default:
      // No era un error de MySQL que sepamos traducir.
      return null;
  }
}

/**
 * Middleware 404: se registra DESPUES de todas las rutas.
 * Si la peticion llego hasta aqui, ninguna ruta coincidio.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {function} next
 */
function rutaNoEncontrada(req, res, next) {
  const error = AppError.rutaNoEncontrada(
    MENSAJES.SISTEMA.RUTA_NO_ENCONTRADA(req.method, req.originalUrl)
  );

  // next(error) salta directo al middleware de errores.
  // Si llamaramos next() sin argumento, seguiria la cadena normal.
  next(error);
}

/**
 * Middleware de errores. DEBE ser el ultimo app.use() de la aplicacion
 * y DEBE declarar cuatro parametros.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {function} next  Obligatorio: sin el, Express no lo trata
 *                         como middleware de errores.
 */
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  // ----- Paso 1: normalizar el error a un AppError -----
  let error = err;

  if (!(error instanceof AppError)) {
    // Caso A: JSON mal formado. express.json() lanza un SyntaxError
    // con la propiedad `body` cuando el cuerpo no se pudo parsear.
    // Un cliente que olvido la cabecera Content-Type produce esto.
    if (error instanceof SyntaxError && 'body' in error) {
      error = AppError.cuerpoInvalido(MENSAJES.SISTEMA.JSON_MAL_FORMADO);
    } else {
      // Caso B: error del driver de MySQL.
      const traducido = traducirErrorMySQL(error);

      if (traducido !== null) {
        error = traducido;
      } else {
        // Caso C: cualquier otro error inesperado (un bug nuestro).
        // No mostramos el mensaje interno al cliente para no filtrar
        // detalles de implementacion; eso solo viaja al log.
        error = AppError.interno(MENSAJES.SISTEMA.ERROR_INTERNO);
      }
    }
  }

  // ----- Paso 2: registrar en el log del servidor -----
  const esErrorServidor = error.status >= HTTP.ERROR_INTERNO;

  if (esErrorServidor) {
    // Los errores 5xx son bugs: registramos TODO, incluido el stack.
    console.error(
      `${COLOR.rojo}[ERROR ${error.status}]${COLOR.reinicio} ` +
        `${req.method} ${req.originalUrl}\n`,
      err.stack || err
    );
  } else if (config.esDesarrollo) {
    // Los 4xx son errores del cliente: una linea basta.
    console.warn(
      `${COLOR.amarillo}[AVISO ${error.status}]${COLOR.reinicio} ` +
        `${req.method} ${req.originalUrl} -> ${error.message}`
    );
  }

  // ----- Paso 3: responder al cliente -----
  return respuesta.error(res, {
    estado: error.status,
    codigo: error.codigo,
    mensaje: error.message,
    detalles: error.detalles
  });
}

module.exports = {
  rutaNoEncontrada,
  manejadorErrores,
  traducirErrorMySQL
};
