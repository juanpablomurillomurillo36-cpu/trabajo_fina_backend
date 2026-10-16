/**
 * src/middleware/errorHandler.js
 * ---------------------------------------------------------------------
 * Manejadores de error de Express.
 *
 * COMO LLEGA UN ERROR HASTA AQUI?
 *
 *   Express tiene UN manejador de errores final. Cualquier `throw` que
 *   ocurra en una ruta, un controller o un service termina aqui y solo
 *   aqui se decide que respuesta HTTP se manda. Eso garantiza que TODA
 *   la API responda con el mismo formato:
 *
 *      { ok: false, error: { codigo, mensaje, detalles } }
 *
 * capturarAsync() - EL TRUCO QUE LIMPIA LOS CONTROLLERS
 * ---------------------------------------------------------------------
 *   Si un controller es `async` y lanza un error, Express 4 NO lo
 *   atrapa solo: la promesa queda rechazada y el cliente se queda sin
 *   respuesta. La solucion clasica seria envolver cada metodo en
 *   try/catch, lo cual repite codigo por todos lados (anti R-DRY).
 *
 *   `capturarAsync` envuelve el controller una sola vez y deriva
 *   cualquier error al manejador central. Gracias a esto, en los
 *   controllers NO hay NI UN try/catch.
 */

const respuesta = require('../utils/respuesta');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const { registrar } = require('./logger');

/**
 * Envuelve un controlador async para que sus errores vayan al
 * manejador central.
 *
 *   listar = capturarAsync(async (req, res) => { ... })
 *
 * @param {function} controlador  Funcion async (req, res)
 * @returns {function} Funcion compatible con Express
 */
function capturarAsync(controlador) {
  // Express detecta los middlewares con 4 parametros como "de errores".
  // Por eso manejamos explicitamente los 3 argumentos.
  return function (req, res, next) {
    // Promise.resolve(...).catch() garantiza que TANTO los errores
    // lanzados con `throw` como las promesas rechazadas caigan en
    // `next(error)`.
    Promise.resolve(controlador(req, res, next)).catch(next);
  };
}

/**
 * Ultima ruta de la API: si ninguna ruta coincide, responde 404.
 * Se monta DESPUES de todas las rutas, en config/express.js.
 *
 * @param {object} req
 * @param {object} res
 */
function rutaNoEncontrada(req, res) {
  const error = AppError.noEncontrado(
    MENSAJES.SISTEMA.RUTA_NO_ENCONTRADA(`${req.method} ${req.originalUrl}`)
  );

  return respuesta.fallo(res, error);
}

/**
 * MANEJADOR DE ERRORES GLOBAL.
 *
 * Express reconoce este middleware porque recibe CUATRO parametros
 * (err, req, res, next). Es el unico lugar que decide la respuesta
 * final cuando algo sale mal.
 *
 * FLUJO:
 *   1. Si es un AppError -> ya trae su codigo HTTP, se responde tal cual.
 *   2. Si es otro error (inesperado) -> se loguea completo y se
 *      responde 500 con mensaje GENERICO (nunca filtrar detalles
 *      internos al cliente).
 *
 * @param {Error} err
 * @param {object} req
 * @param {object} res
 * @param {function} next  Obligatorio para que Express lo reconozca
 */
function manejadorErrores(err, req, res, next) {
  // Esta linea existe solo para que el parametro `next` cuente.
  // Si Express no ve 4 argumentos, no trata este bloque como
  // manejador de errores.
  if (typeof next !== 'function') return;

  // ---- Caso 0: errores que SABEMOS traducir a un AppError ----
  // Se convierten ANTES de decidir, para que sigan el mismo camino de
  // respuesta (y el mismo formato de logueo) que cualquier otro error
  // de la aplicacion. Sin esta normalizacion, un JSON mal formado
  // llegaria como 500 "inesperado" y el cliente no sabria que EL fue
  // quien mando mal la peticion.
  const errorTraducido = interpretarErrorCuerpoJson(err);
  if (errorTraducido !== null) {
    err = errorTraducido;
  }

  // ---- Caso 1: error de la aplicacion (AppError) ----
  if (err instanceof AppError) {
    // Los 4xx son esperados (el cliente mando algo mal): se loguea en
    // nivel "aviso", no en error, para no ensuciar el log.
    registrar(
      err.estado >= 500 ? 'error' : 'aviso',
      `${err.codigo} ${err.estado}`,
      { ruta: `${req.method} ${req.originalUrl}`, mensaje: err.message, detalles: err.detalles }
    );

    return respuesta.fallo(res, err);
  }

  // ---- Caso 2: error de MySQL con codigo conocido ----
  const errorMysql = interpretarErrorMysql(err);
  if (errorMysql !== null) {
    registrar('error', `MYSQL ${errorMysql.codigo}`, {
      ruta: `${req.method} ${req.originalUrl}`,
      mensaje: err.message
    });

    return respuesta.fallo(res, errorMysql);
  }

  // ---- Caso 3: error inesperado ----
  // El detalle COMPLETO (stack trace) se guarda en el log del servidor.
  // Al cliente solo se le dice que fallo algo, sin expor internos.
  registrar('error', 'NO_PREVISTO', {
    ruta: `${req.method} ${req.originalUrl}`,
    mensaje: err.message,
    pila: err.stack
  });

  return respuesta.fallo(res, AppError.interno(MENSAJES.SISTEMA.ERROR_INTERNO));
}

/**
 * Detecta el error que lanza body-parser cuando el cuerpo NO es JSON
 * valido (llaves sin comillas, coma final, texto plano, etc.).
 *
 * POR QUE HACE FALTA?
 * Porque body-parser lanza un SyntaxError generico, y si nadie lo
 * traduce la API responde 500 (culpa del servidor) cuando en realidad
 * quien fallo fue el cliente: corresponde un 400.
 *
 * El comprobante `err.status === 400` es importante: NO basta con
 * `instanceof SyntaxError`, porque el servidor podria lanzar un
 * SyntaxError propio por un bug interno, y ese si es un 500.
 *
 * @param {Error} err
 * @returns {AppError|null} 400 si es un JSON mal formado; null si no.
 */
function interpretarErrorCuerpoJson(err) {
  if (!(err instanceof SyntaxError) || err.status !== 400) return null;

  // err.message trae la posicion exacta del fallo
  // ("...JSON at position 12"): es informacion que viene DEL CLIENTE,
  // por eso es seguro devolverla y le sirve para corregir su peticion.
  return AppError.validacion(MENSAJES.VALIDACION.CORPUS_JSON_INVALIDO, [
    { campo: 'cuerpo', mensaje: err.message }
  ]);
}

/**
 * Traduce los codigos de error mas comunes de MySQL a errores de la
 * API con su codigo HTTP correcto.
 *
 *   ER_DUP_ENTRY (1062) -> 409 Conflicto (ya existe un registro unico)
 *   ER_ROW_IS_REFERENCED -> 409 (no se puede borrar: esta en uso)
 *   ER_NO_REFERENCED_ROW -> 400 (referencia a algo que no existe)
 *
 * Si el codigo no se conoce, devuelve null y el manejador sigue.
 *
 * @param {Error} err
 * @returns {AppError|null}
 */
function interpretarErrorMysql(err) {
  if (!err || typeof err.code !== 'string') return null;

  switch (err.code) {
    case 'ER_DUP_ENTRY': {
      // err.sqlMessage trae el nombre del indice que fallo, lo que
      // permite dar un mensaje concreto ("ya existe...").
      const detalle = err.sqlMessage || 'Valor duplicado';
      return AppError.conflicto(MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('registro', detalle), [
        { campo: 'registro', mensaje: detalle }
      ]);
    }

    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return AppError.conflicto('No se puede eliminar: el registro esta siendo utilizado por otros datos.');

    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return AppError.validacion('La referencia indicada no existe en la base de datos.');

    case 'ER_DATA_TOO_LONG':
      return AppError.validacion('Uno de los campos supera la longitud maxima permitida.');

    case 'ER_BAD_NULL_ERROR':
      return AppError.validacion('Uno de los campos obligatorios viene vacio.');

    default:
      return null;
  }
}

module.exports = {
  capturarAsync,
  rutaNoEncontrada,
  manejadorErrores,
  interpretarErrorMysql,
  interpretarErrorCuerpoJson
};
