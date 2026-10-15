/**
 * src/utils/AppError.js
 * ---------------------------------------------------------------------
 * Clase de error de la APLICACION.
 *
 * HERENCIA (regla P2 de POO)
 * ---------------------------------------------------------------------
 *   class AppError extends Error
 *
 *   AppError ES UN Error (relacion "es-un"). Gracias a la herencia,
 *   cualquier lugar que espere un Error (Express, un catch, Node)
 *   acepta un AppError sin que haya que adaptar nada. Ademas hereda
 *   el stack trace, que dice en que archivo y linea fallo.
 *
 * POR QUE NO lanzar errores genéricos?
 * ---------------------------------------------------------------------
 *   Si en un service hacemos `throw new Error('no existe')`, el
 *   middleware no sabe si es un 404, un 400 o un 500. Con AppError
 *   LLEVA ADENTRO el codigo HTTP, y el middleware solo lo lee:
 *
 *      throw AppError.noEncontrado('El rol solicitado no existe');
 *      -> el middleware responde 404 automaticamente.
 *
 * FABRICAS ESTATICAS (regla P6: polimorfismo)
 * ---------------------------------------------------------------------
 *   Los metodos `static` pertenecen a la CLASE, no a una instancia:
 *      AppError.noEncontrado(...)   <- correcto
 *      miError.noEncontrado(...)    <- no existe
 *   Son "constructores con nombre": dejan clarisimo que clase de error
 *   se esta lanzando al solo leer la linea.
 */

class AppError extends Error {
  // Atributos privados: solo el objeto mismo decide que expone.
  #codigo;
  #estado;
  #detalles;

  /**
   * @param {string} mensaje   Mensaje entendible por quien consuma la API.
   * @param {number} estado    Codigo HTTP (400, 404, 409, 500...).
   * @param {string} codigo    Codigo interno propio, ej. "E-404".
   * @param {Array}  detalles  Lista de { campo, mensaje } de validacion.
   */
  constructor(mensaje, estado = 500, codigo = 'E-500', detalles = []) {
    // super() llama al constructor de la clase padre (Error).
    // Con eso, `error.message` y `error.stack` funcionan como siempre.
    super(mensaje);

    // Mantiene el nombre de la clase al hacer console.log(error).
    this.name = 'AppError';

    this.#codigo = codigo;
    this.#estado = estado;
    this.#detalles = detalles;
  }

  // ---------------------------- Getters ----------------------------

  /** Codigo interno, ej. "E-409". */
  get codigo() {
    return this.#codigo;
  }

  /** Codigo HTTP que se debe responder, ej. 409. */
  get estado() {
    return this.#estado;
  }

  /** Detalles de validacion: [{ campo, mensaje }, ...]. */
  get detalles() {
    // Devolvemos copia para que nadie altere la lista interna.
    return [...this.#detalles];
  }

  // -------------------- Fabricas estaticas -------------------------

  /** 400 - Los datos enviados no son validos. */
  static validacion(mensaje = 'Los datos enviados no son validos.', detalles = []) {
    return new AppError(mensaje, 400, 'E-400', detalles);
  }

  /** 401 - No hay token o el token no es valido. */
  static noAutenticado(mensaje = 'Debes iniciar sesion para acceder a este recurso.') {
    return new AppError(mensaje, 401, 'E-401');
  }

  /** 403 - Tiene sesion, pero no tiene el permiso. */
  static sinPermiso(mensaje = 'No tienes permiso para realizar esta accion.') {
    return new AppError(mensaje, 403, 'E-403');
  }

  /** 404 - El recurso pedido no existe. */
  static noEncontrado(mensaje = 'El recurso solicitado no existe.') {
    return new AppError(mensaje, 404, 'E-404');
  }

  /** 409 - Conflicto: ya existe algo incompatible (nombre duplicado, horario ocupado). */
  static conflicto(mensaje = 'La operacion entra en conflicto con los datos existentes.', detalles = []) {
    return new AppError(mensaje, 409, 'E-409', detalles);
  }

  /** 500 - Error interno no previsto. El mensaje NO se expone al cliente. */
  static interno(mensaje = 'Ocurrio un error inesperado en el servidor.') {
    return new AppError(mensaje, 500, 'E-500');
  }

  // -----------------------------------------------------------------
  // Serializacion
  // -----------------------------------------------------------------

  /**
   * Convierte el error al formato EXACTO que exige el contrato de la API:
   *   { ok: false, error: { codigo, mensaje, detalles } }
   *
   * Es el "toJSON" de esta clase (polimorfismo P6): quien lo llame no
   * tiene que saber como estan guardados los atributos privados.
   *
   * @returns {object}
   */
  aRespuestaError() {
    return {
      codigo: this.#codigo,
      mensaje: this.#estado === 500 ? 'Ocurrio un error inesperado en el servidor.' : this.message,
      detalles: this.#detalles
    };
  }
}

module.exports = AppError;
