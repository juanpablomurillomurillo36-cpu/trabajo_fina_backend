 /**
 * src/models/Acceso.js
 * ---------------------------------------------------------------------
 * ENTIDAD Acceso -> tabla `accesos` de la base de datos.
 *
 * QUE REPRESENTA?
 * UN REGISTRO DE BITACORA de seguridad: cada intento (exitoso o no)
 * de login, logout, registro o edicion de perfil deja una fila aqui.
 *
 * POR QUE ES UN REGISTRO "INMUTABLE"?
 * A diferencia de un Usuario o un Rol, un Acceso NUNCA se edita: si
 * alguien intento entrar con la clave mala a las 2am, ese hecho ya
 * paso y no se puede deshacer editando la fila. Por eso el modelo no
 * ofrece `actualizar()`: solo fabricas para crear y leer.
 *
 * A QUE AYUDA TENERLO?
 *   1. Auditoria (rúbrica): responder "quien entro anoche y a que hora".
 *   2. Sospecha de intruso: varios `fallido` seguidos = ataque de
 *      diccionario en curso.
 *   3. Evidencia: quien cambio su perfil despues de un login raro.
 *
 * REGLAS DE POO
 *   P1 Privados # + getters (sin setters mutables: los valores se
 *      fijan al crear el registro).
 *   P6 Polimorfismo: desdeFila(), desdeJSON(), aFilaBaseDatos(),
 *      toJSON().
 */

const AppError = require('../utils/AppError');
const { TIPO_ACCION_ACCESO, RESULTADO_ACCESO } = require('../utils/constants');

const TIPOS_VALIDOS = Object.freeze(Object.values(TIPO_ACCION_ACCESO));
const RESULTADOS_VALIDOS = Object.freeze(Object.values(RESULTADO_ACCESO));

class Acceso {
  #idAcceso;
  #idUsuario;
  #tipoAccion;
  #fechaHora;
  #ipOrigen;
  #resultado;

  /**
   * @param {number|null} id
   * @param {number}      idUsuario   FK hacia usuarios (NOT NULL).
   * @param {string}      tipoAccion  ENUM de TIPO_ACCION_ACCESO.
   * @param {string|null} fechaHora   Solo llega de MySQL (DEFAULT).
   * @param {string|null} ipOrigen    varchar(45); puede ser null.
   * @param {string}      resultado   'exitoso' | 'fallido'.
   */
  constructor(
    id = null,
    idUsuario = null,
    tipoAccion = TIPO_ACCION_ACCESO.LOGIN,
    fechaHora = null,
    ipOrigen = null,
    resultado = RESULTADO_ACCESO.EXITOSO
  ) {
    this.#idAcceso = id;
    this.#idUsuario = idUsuario;
    this.#fechaHora = fechaHora;
    this.#ipOrigen = ipOrigen ?? null;

    // Validados a mano (sin setter mutables): un valor fuera del ENUM
    // haria fallar el INSERT con un error crudo de MySQL; aqui el
    // programador recibe un 500 claro y explicado.
    if (!TIPOS_VALIDOS.includes(tipoAccion)) {
      throw AppError.interno(`Tipo de accion de acceso invalido: ${tipoAccion}`);
    }
    if (!RESULTADOS_VALIDOS.includes(resultado)) {
      throw AppError.interno(`Resultado de acceso invalido: ${resultado}`);
    }

    this.#tipoAccion = tipoAccion;
    this.#resultado = resultado;
  }

  // =====================================================================
  // GETTERS (solo lectura: el registro no se edita)
  // =====================================================================

  get id() {
    return this.#idAcceso;
  }

  get idUsuario() {
    return this.#idUsuario;
  }

  get tipoAccion() {
    return this.#tipoAccion;
  }

  get fechaHora() {
    return this.#fechaHora;
  }

  get ipOrigen() {
    return this.#ipOrigen;
  }

  get resultado() {
    return this.#resultado;
  }

  /** Util para listados: true si el intento salio bien. */
  esExitoso() {
    return this.#resultado === RESULTADO_ACCESO.EXITOSO;
  }

  // =====================================================================
  // FABRICAS ESTATICAS
  // =====================================================================

  /**
   * Fila de MySQL -> objeto Acceso.
   *
   * @param {object} fila
   * @returns {Acceso|null}
   */
  static desdeFila(fila) {
    if (!fila) return null;

    return new Acceso(
      fila.id_acceso,
      fila.id_usuario,
      fila.tipo_accion,
      fila.fecha_hora,
      fila.ip_origen,
      fila.resultado
    );
  }

  /**
   * JSON ya normalizado por el service -> objeto Acceso.
   *
   * @param {object} datos
   * @returns {Acceso}
   */
  static desdeJSON(datos = {}) {
    return new Acceso(
      datos.id ?? datos.idAcceso ?? null,
      datos.idUsuario ?? null,
      datos.tipoAccion ?? TIPO_ACCION_ACCESO.LOGIN,
      datos.fechaHora ?? null,
      datos.ipOrigen ?? null,
      datos.resultado ?? RESULTADO_ACCESO.EXITOSO
    );
  }

  // =====================================================================
  // SERIALIZACION
  // =====================================================================

  /**
   * Formato de fila para INSERT (snake_case).
   *
   * NO incluye fecha_hora: esa columna tiene DEFAULT
   * CURRENT_TIMESTAMP en MySQL, quien decide el reloj es la base.
   *
   * @returns {object}
   */
  aFilaBaseDatos() {
    return {
      id_usuario: this.#idUsuario,
      tipo_accion: this.#tipoAccion,
      ip_origen: this.#ipOrigen,
      resultado: this.#resultado
    };
  }

  /**
   * Serializacion para el cliente (camelCase).
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.#idAcceso,
      idUsuario: this.#idUsuario,
      tipoAccion: this.#tipoAccion,
      fechaHora: this.#fechaHora,
      ipOrigen: this.#ipOrigen,
      resultado: this.#resultado
    };
  }
}

module.exports = Acceso;
