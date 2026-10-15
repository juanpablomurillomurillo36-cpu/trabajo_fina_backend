/**
 * src/models/Permiso.js
 * ---------------------------------------------------------------------
 * ENTIDAD Permiso -> tabla `permisos` de la base de datos.
 *
 * Un permiso es una ACCION concreta que alguien puede realizar, por
 * ejemplo "roles.crear" o "ventas.anular". Los permisos no viven
 * solos: se ASIGNAN a los roles a traves de la tabla puente
 * `rol_permiso` (relacion muchostomuchos).
 *
 * DIFERENCIA CON Rol
 *   - `permisos` NO tiene columna `fecha_creacion` en la base de
 *     datos, por eso este modelo tampoco la maneja.
 *   - `permisos` no expone una coleccion de roles: la relacion se
 *     administra desde el lado del Rol (asignar/quitar), que es como
 *     pide el requisito RF-ROL-01.
 *
 * APLICACION DE LA POO (mismo patron que Rol y Usuario):
 *   - P1  atributos PRIVADOS con #, acceso por get/set.
 *   - P6  fabricas estaticas desdeFila()/desdeJSON() y serializacion
 *         aFilaBaseDatos()/toJSON() (polimorfismo).
 */

const { ESTADO } = require('../utils/constants');

class Permiso {
  // ---- Atributos privados (declarados arriba para documentar la clase) ----
  #id;
  #nombrePermiso;
  #descripcion;
  #estado;

  /**
   * @param {number|null} id           Null cuando el permiso aun no se guardo.
   * @param {string}      nombrePermiso Unico en la base (uq_permisos_nombre).
   * @param {string|null} descripcion
   * @param {string}      estado       'activo' | 'inactivo'
   */
  constructor(id = null, nombrePermiso, descripcion = null, estado = ESTADO.ACTIVO) {
    this.#id = id;

    // Por SETTER (y no this.#nombrePermiso) para que la normalizacion
    // aplique tambien en desdeFila() y desdeJSON().
    this.nombrePermiso = nombrePermiso;
    this.descripcion = descripcion;
    this.#estado = estado;
  }

  // =====================================================================
  // GETTERS Y SETTERS
  // =====================================================================

  get id() {
    return this.#id;
  }

  set id(valor) {
    this.#id = valor;
  }

  get nombrePermiso() {
    return this.#nombrePermiso;
  }

  /**
   * Recorta espacios sobrantes.
   *
   * POR QUE? La columna nombre_permiso es UNIQUE y ademas el nombre se
   * USA COMO LLAVE en la autorizacion: el middleware comparara
   * `permiso.nombrePermiso === 'roles.crear'`. Un espacio invisible
   * haria que la comparacion falle en silencio y el permiso dejara de
   * funcionar aunque "existiera".
   */
  set nombrePermiso(valor) {
    this.#nombrePermiso = typeof valor === 'string' ? valor.trim() : valor;
  }

  get descripcion() {
    return this.#descripcion;
  }

  set descripcion(valor) {
    this.#descripcion = typeof valor === 'string' ? valor.trim() : valor;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  // =====================================================================
  // METODOS DE NEGOCIO
  // =====================================================================

  /** true si el permiso esta activo. */
  estaActivo() {
    return this.#estado === ESTADO.ACTIVO;
  }

  /** Marca el permiso como activo. */
  activar() {
    this.#estado = ESTADO.ACTIVO;
  }

  /** Marca el permiso como inactivo (baja logica, no se borra la fila). */
  desactivar() {
    this.#estado = ESTADO.INACTIVO;
  }

  /**
   * Devuelve el nombre "legible" del permiso, convirtiendo la llave en
   * texto: "roles.crear" -> "Roles > Crear".
   *
   * Sirve para mostrar el permiso en la interfaz sin que el usuario
   * tenga que interpretar el formato de llave.
   *
   * @returns {string}
   */
  obtenerNombreLegible() {
    return this.#nombrePermiso
      .split('.')
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' > ');
  }

  // =====================================================================
  // METODOS ESTATICOS (de fabrica)
  // =====================================================================

  /**
   * Construye un Permiso a partir de una fila de MySQL.
   * Traduce snake_case a camelCase: nombre_permiso -> nombrePermiso.
   *
   * @param {object} fila  Fila devuelta por el driver mysql2.
   * @returns {Permiso|null}
   */
  static desdeFila(fila) {
    if (!fila) return null;

    return new Permiso(
      fila.id_permiso,
      fila.nombre_permiso,
      fila.descripcion,
      fila.estado
    );
  }

  /**
   * Construye un Permiso a partir del JSON del cliente.
   *
   * @param {object} datos  Objeto con llaves en camelCase.
   * @returns {Permiso}
   */
  static desdeJSON(datos = {}) {
    return new Permiso(
      datos.id ?? null,
      datos.nombrePermiso,
      datos.descripcion ?? null,
      datos.estado ?? ESTADO.ACTIVO
    );
  }

  // =====================================================================
  // SERIALIZACION
  // =====================================================================

  /**
   * Formato de FILA para MySQL.
   *
   * No incluye `id` (AUTO_INCREMENT) porque en el INSERT lo genera la
   * base y en el UPDATE viaja en el WHERE.
   *
   * @returns {object}
   */
  aFilaBaseDatos() {
    return {
      nombre_permiso: this.#nombrePermiso,
      descripcion: this.#descripcion,
      estado: this.#estado
    };
  }

  /**
   * JSON que viaja al frontend (lo llama JSON.stringify automatico).
   *
   * Se agrega `nombreLegible` calculado en el momento: es derivado del
   * nombre, asi que no se guarda en la base ni se acepta del cliente.
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.#id,
      nombrePermiso: this.#nombrePermiso,
      nombreLegible: this.obtenerNombreLegible(),
      descripcion: this.#descripcion,
      estado: this.#estado,
      activo: this.estaActivo()
    };
  }
}

module.exports = Permiso;
