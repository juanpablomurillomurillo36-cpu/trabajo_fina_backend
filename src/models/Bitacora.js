/**
 * src/models/Bitacora.js
 * ---------------------------------------------------------------------
 * ENTIDAD Bitacora -> tabla `bitacora` de la base de datos.
 *
 * QUE REPRESENTA?
 * LA HISTORIA de los cambios importantes: QUIEN hizo QUE y CUANDO
 * sobre un registro (creo, edito o anulo).
 *
 * DIFERENCIA CON Acceso
 *   accesos  -> auditoria de SESIONES (quien entro, con que resultado).
 *   bitacora -> auditoria de DATOS (quien borro la venta 42).
 * Son dos preguntas distintas y la rubrica exige ambas (C8).
 *
 * POR QUE `tabla` ES TEXTO Y NO FK?
 * Porque apunta a MUCHAS tablas distintas (usuarios, roles, ventas...).
 * Una FK solo puede apuntar a UNA tabla; por eso la columna es un
 * nombre libre y el indice compuesto (tabla, id_registro) acelera la
 * pregunta tipica: "historial de la venta 42".
 *
 * REGLAS DE POO
 *   P1 Privados # + getters.
 *   P6 Polimorfismo: desdeFila(), desdeJSON(), aFilaBaseDatos(),
 *      toJSON().
 */

const AppError = require('../utils/AppError');
const { ACCION_BITACORA } = require('../utils/constants');

const ACCIONES_VALIDAS = Object.freeze(Object.values(ACCION_BITACORA));

class Bitacora {
  #idBitacora;
  #idUsuario;
  #tabla;
  #idRegistro;
  #accion;
  #detalle;
  #direccionIp;
  #fechaHora;

  // Nombre del usuario que ejecuto la accion (viene de un JOIN);
  #nombreUsuario;

  /**
   * @param {number|null} id
   * @param {number}      idUsuario    FK hacia usuarios (quien hizo).
   * @param {string}      tabla        'usuarios', 'roles', 'ventas'...
   * @param {number|null} idRegistro   Id del registro afectado.
   * @param {string}      accion       'CREACION' | 'EDICION' | 'ANULACION'.
   * @param {string|null} detalle      Resumen legible del cambio.
   * @param {string|null} direccionIp  IPv4 o IPv6 de quien ejecuto.
   * @param {string|null} fechaHora    Solo llega de MySQL (DEFAULT).
   */
  constructor(
    id = null,
    idUsuario = null,
    tabla = '',
    idRegistro = null,
    accion = ACCION_BITACORA.CREACION,
    detalle = null,
    direccionIp = null,
    fechaHora = null
  ) {
    this.#idBitacora = id;
    this.#idUsuario = idUsuario;
    this.#tabla = tabla;
    this.#idRegistro = idRegistro;
    this.#detalle = detalle ?? null;
    this.#direccionIp = direccionIp ?? null;
    this.#fechaHora = fechaHora;
    this.#nombreUsuario = null;

    // Un valor fuera del ENUM haria fallar el INSERT con un error
    // crudo de MySQL; aqui el programador recibe un 500 explicado.
    if (!ACCIONES_VALIDAS.includes(accion)) {
      throw AppError.interno(`Accion de bitacora invalida: ${accion}`);
    }

    this.#accion = accion;
  }

  // =====================================================================
  // GETTERS (solo lectura: la auditoria no se edita)
  // =====================================================================

  get id() {
    return this.#idBitacora;
  }

  get idUsuario() {
    return this.#idUsuario;
  }

  get tabla() {
    return this.#tabla;
  }

  get idRegistro() {
    return this.#idRegistro;
  }

  get accion() {
    return this.#accion;
  }

  get detalle() {
    return this.#detalle;
  }

  get direccionIp() {
    return this.#direccionIp;
  }

  get fechaHora() {
    return this.#fechaHora;
  }

  get nombreUsuario() {
    return this.#nombreUsuario;
  }

  // =====================================================================
  // FABRICAS ESTATICAS
  // =====================================================================

  /**
   * Fila de MySQL -> objeto Bitacora (acepta JOIN con `nombre_usuario`).
   *
   * @param {object} fila
   * @returns {Bitacora|null}
   */
  static desdeFila(fila) {
    if (!fila) return null;

    const evento = new Bitacora(
      fila.id_bitacora,
      fila.id_usuario,
      fila.tabla,
      fila.id_registro,
      fila.accion,
      fila.detalle,
      fila.direccion_ip,
      fila.fecha_hora
    );

    // Solo el listado trae el nombre via JOIN (como Usuario con
    // nombre_rol): si la columna vino, se expone; si no, queda null.
    if (fila.nombre_usuario !== undefined) {
      evento.#nombreUsuario = fila.nombre_usuario ?? null;
    }

    return evento;
  }

  /**
   * JSON ya normalizado por el service -> objeto Bitacora.
   *
   * @param {object} datos
   * @returns {Bitacora}
   */
  static desdeJSON(datos = {}) {
    return new Bitacora(
      datos.id ?? datos.idBitacora ?? null,
      datos.idUsuario ?? null,
      datos.tabla ?? '',
      datos.idRegistro ?? null,
      datos.accion ?? ACCION_BITACORA.CREACION,
      datos.detalle ?? null,
      datos.direccionIp ?? null,
      datos.fechaHora ?? null
    );
  }

  // =====================================================================
  // SERIALIZACION
  // =====================================================================

  /**
   * Formato de fila para INSERT (snake_case).
   *
   * NO incluye fecha_hora: esa columna tiene DEFAULT
   * CURRENT_TIMESTAMP en MySQL (el reloj lo pone la base).
   *
   * @returns {object}
   */
  aFilaBaseDatos() {
    return {
      id_usuario: this.#idUsuario,
      tabla: this.#tabla,
      id_registro: this.#idRegistro,
      accion: this.#accion,
      detalle: this.#detalle,
      direccion_ip: this.#direccionIp
    };
  }

  /**
   * Serializacion para el cliente (camelCase).
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.#idBitacora,
      idUsuario: this.#idUsuario,
      nombreUsuario: this.#nombreUsuario,
      tabla: this.#tabla,
      idRegistro: this.#idRegistro,
      accion: this.#accion,
      detalle: this.#detalle,
      direccionIp: this.#direccionIp,
      fechaHora: this.#fechaHora
    };
  }
}

module.exports = Bitacora;
