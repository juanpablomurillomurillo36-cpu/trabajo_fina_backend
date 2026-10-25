/**
 * src/utils/AppError.js
 * ---------------------------------------------------------------------
 * ERROR DE APLICACION con codigo HTTP y codigo de negocio propios.
 *
 * POR QUE NO BASTA CON `throw new Error('algo fallo')`?
 *
 * Un Error a secas solo trae un mensaje para humanos. La capa de
 * respuesta necesita, ademas:
 *
 *   - un STATUS HTTP (404, 409, 500...),
 *   - un CODIGO tecnico estable ("NO_ENCONTRADO") con el que el
 *     frontend puede decidir que hacer sin traducir textos,
 *   - y opcionalmente DETALLES de validacion campo por campo.
 *
 * Eso es exactamente lo que expone `error.aJSON()`.
 *
 * APLICACION DE LA POO
 *   - HERENCIA: `class AppError extends Error`. Heredamos de la clase
 *     nativa para que `instanceof Error` siga siendo verdadero y
 *     `error.stack` siga existiendo en los logs.
 *   - ENCAPSULAMIENTO: los tres campos van privados (#). Solo se leen
 *     por getters, y el estado interno no lo puede tocar nadie desde
 *     afuera.
 *   - POLIMORFISMO: las fabricas estaticas (validacion, noEncontrado,
 *     conflicto, interno...) construyen la MISMA clase con distintos
 *     parametros. El manejador de errores no tiene que saber cual se
 *     uso: siempre llama `aJSON()`.
 *
 *   const error = AppError.noEncontrado('Ese rol no existe');
 *   error instanceof Error     // true
 *   error.status               // 404
 */

const { HTTP, CODIGO_ERROR } = require('./constants');

class AppError extends Error {
  // ---- Atributos privados ----
  #status;
  #codigo;
  #detalles;

  /**
   * @param {string} mensaje      Texto legible que llega al cliente.
   * @param {number} status       Codigo HTTP de la respuesta.
   * @param {string} codigo       Codigo tecnico estable.
   * @param {object|Array|null} detalles  Violaciones campo a campo.
   * @param {Error|null} causa    Error original (para el log).
   */
  constructor(mensaje, status = HTTP.ERROR_INTERNO, codigo = CODIGO_ERROR.INTERNO, detalles = null, causa = null) {
    // super() debe ser la PRIMERA linea: inicializa `message` y
    // `stack` de la clase base Error.
    super(mensaje);

    // Nombre de la clase: hace que el stack muestre "AppError" y no
    // "Error".
    this.name = 'AppError';

    this.#status = status;
    this.#codigo = codigo;
    this.#detalles = detalles;

    if (causa) {
      // `cause` es un estandar de ECMAScript 2022 para encadenar el
      // error original sin perder la traza.
      this.cause = causa;
    }

    // Capturar el stack aqui y no en la linea de throw hace que el
    // stack apunte al lugar REAL donde se creo el error.
    Error.captureStackTrace(this, AppError);
  }

  // ---------------------------- Getters ----------------------------

  /** Codigo HTTP (404, 409, ...). */
  get status() {
    return this.#status;
  }

  /** Codigo tecnico estable ("NO_ENCONTRADO"). */
  get codigo() {
    return this.#codigo;
  }

  /** Detalles de validacion o `null`. */
  get detalles() {
    return this.#detalles;
  }

  // ------------------- Fabricas estaticas -------------------------
  //
  // Son metodos de CLASE (static): se llaman como AppError.x() sin
  // instanciar. Encapsulan el par status/codigo para que nadie tenga
  // que recordar numeros mágicos.

  /**
   * 400 - La peticion esta mal formada o trae datos invalidos.
   * @param {string} mensaje
   * @param {Array|object|null} detalles
   * @returns {AppError}
   */
  static validacion(mensaje, detalles = null) {
    return new AppError(mensaje, HTTP.BAD_REQUEST, CODIGO_ERROR.VALIDACION, detalles);
  }

  /**
   * 400 - El cuerpo JSON no es valido o no trae los campos requeridos.
   * @param {string} mensaje
   * @param {Array|object|null} detalles
   * @returns {AppError}
   */
  static cuerpoInvalido(mensaje, detalles = null) {
    return new AppError(mensaje, HTTP.BAD_REQUEST, CODIGO_ERROR.CUERPO_INVALIDO, detalles);
  }

  /**
   * 404 - El recurso pedido no existe.
   * @param {string} mensaje
   * @returns {AppError}
   */
  static noEncontrado(mensaje) {
    return new AppError(mensaje, HTTP.NO_ENCONTRADO, CODIGO_ERROR.NO_ENCONTRADO);
  }

  /**
   * 409 - La peticion choca con el estado actual (registro duplicado,
   *        registro con hijos, permiso repetido...).
   * @param {string} mensaje
   * @param {Array|object|null} detalles
   * @returns {AppError}
   */
  static conflicto(mensaje, detalles = null) {
    return new AppError(mensaje, HTTP.CONFLICTO, CODIGO_ERROR.CONFLICTO, detalles);
  }

  /**
   * 401 - No hay credenciales validas. Se usara en la fase de JWT.
   * @param {string} mensaje
   * @returns {AppError}
   */
  static noAutenticado(mensaje) {
    return new AppError(mensaje, HTTP.NO_AUTENTICADO, CODIGO_ERROR.NO_AUTENTICADO);
  }

  /**
   * 403 - Hay sesion pero no hay permiso para esta accion.
   * @param {string} mensaje
   * @returns {AppError}
   */
  static sinPermiso(mensaje) {
    return new AppError(mensaje, HTTP.SIN_PERMISO, CODIGO_ERROR.SIN_PERMISO);
  }

  /**
   * 500 - La base de datos respondio con un error que no esperabamos.
   * Se usa poco: casi todos los casos de MySQL ya los traduce el
   * manejador de errores.
   *
   * @param {string} mensaje
   * @param {Error|null} causa
   * @returns {AppError}
   */
  static baseDatos(mensaje, causa = null) {
    return new AppError(mensaje, HTTP.ERROR_INTERNO, CODIGO_ERROR.BASE_DE_DATOS, null, causa);
  }

  /**
   * 500 - Falla imprevista del codigo. `AppError.interno()` es la que
   * mas se usa para "defenderse": si algo llega en un formato que no
   * deberia (un valor de enum invalido, por ejemplo), en vez de
   * guardar un dato corrupto se lanza este error y la peticion muere
   * con 500 en lugar de corromper la base.
   *
   * @param {string} mensaje
   * @param {Error|null} causa
   * @returns {AppError}
   */
  static interno(mensaje, causa = null) {
    return new AppError(mensaje, HTTP.ERROR_INTERNO, CODIGO_ERROR.INTERNO, null, causa);
  }

  /**
   * 404 - Ninguna ruta coincidio con la peticion.
   * @param {string} mensaje
   * @returns {AppError}
   */
  static rutaNoEncontrada(mensaje) {
    return new AppError(mensaje, HTTP.NO_ENCONTRADO, CODIGO_ERROR.RUTA_NO_ENCONTRADA);
  }

  // ------------------------ Serializacion --------------------------

  /**
   * Formato EXACTO del cuerpo de error que sale por la API:
   *
   *   {
   *     "ok": false,
   *     "error": {
   *       "codigo": "NO_ENCONTRADO",
   *       "mensaje": "No existe el rol con id 999",
   *       "detalles": null
   *     }
   *   }
   *
   * JSON.stringify() lo llama solo cuando hacemos res.json(error).
   *
   * @returns {object}
   */
  aJSON() {
    return {
      ok: false,
      error: {
        codigo: this.#codigo,
        mensaje: this.message,
        detalles: this.#detalles
      }
    };
  }
}

module.exports = AppError;
