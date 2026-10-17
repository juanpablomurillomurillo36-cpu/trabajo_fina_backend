/**
 * src/models/Usuario.js
 * ---------------------------------------------------------------------
 * ENTIDAD Usuario -> tabla `usuarios` de la base de datos.
 *
 * QUE HACE ESTE MODELO?
 * Representa a una persona con cuenta en el sistema (administrador,
 * barman, recepcionista...). NO es lo mismo que `clientes`: un cliente
 * entra a la discoteca; un USUARIO entra al sistema.
 *
 * EL SECRETO MAS IMPORTANTE DE ESTA CLASE
 * ---------------------------------------------------------------------
 * La contrase\u00f1a NUNCA se guarda en claro. El unico dato que se
 * persiste es `contrasena_hash` (bcrypt), y por eso:
 *
 *   - toJSON() NO incluye ese atributo. Si lo incluyera, cualquier
 *     persona que consulte /api/usuarios/7 veria el hash de la
 *     contrase\u00f1a, y con el hash se pueden probar contrase\u00f1as
 *     offline (ataque de diccionario).
 *   - Se expone en su lugar un METODO `contrasenaCoincide()`: quien
 *     pregunta no recibe el secreto, solo la respuesta si/no.
 *     Eso es encapsulamiento real (P5).
 *
 * REGLAS DE POO APLICADAS
 *   P1 Privados con # + getters/setters (el setter de email ademas
 *      normaliza a minusculas para que "Juan@Correo.mx" y
 *      "juan@correo.mx" no creen DOS usuarios distintos).
 *   P5 Metodos de comportamiento: activar(), desactivar(),
 *      cambiarContrasena(), contrasenaCoincide().
 *   P6 Polimorfismo: desdeFila(), desdeJSON(), aFilaBaseDatos(),
 *      toJSON().
 */

const fechas = require('../utils/fechas');
const { ESTADO } = require('../utils/constants');
const cifrado = require('../utils/cifrado');

class Usuario {
  #idUsuario;
  #idRol;
  #nombre;
  #apellido;
  #email;
  #contrasenaHash;
  #telefono;
  #estado;
  #fechaCreacion;

  // Nombre del rol (columna `nombre_rol`), SOLO cuando la consulta la
  // trae mediante un JOIN (el detalle). En el listado no viene y el
  // getter devuelve null, por lo que toJSON() la omite.
  #nombreRol;

  /**
   * @param {number|null} id
   * @param {number}      idRol           FK hacia roles (NOT NULL).
   * @param {string}      nombre          VARCHAR(80) NOT NULL.
   * @param {string}      apellido        VARCHAR(80) NOT NULL.
   * @param {string}      email           VARCHAR(120) NOT NULL UNIQUE.
   * @param {string|null} contrasenaHash  bcrypt; null solo en fabricas
   *                                      que no traen credenciales.
   * @param {string|null} telefono        VARCHAR(20) NULL.
   * @param {string}      estado          'activo' | 'inactivo'.
   * @param {string|null} fechaCreacion   Solo llega desde MySQL.
   */
  constructor(
    id = null,
    idRol = null,
    nombre = '',
    apellido = '',
    email = '',
    contrasenaHash = null,
    telefono = null,
    estado = ESTADO.ACTIVO,
    fechaCreacion = null
  ) {
    this.#idUsuario = id;
    this.#idRol = idRol;

    // Se asignan POR SETTER para que la normalizacion (recorte y
    // minusculas) aplique en TODOS los caminos de creacion.
    this.nombre = nombre;
    this.apellido = apellido;
    this.email = email;
    this.telefono = telefono;
    this.#contrasenaHash = contrasenaHash;

    this.#estado = estado;
    this.#fechaCreacion = fechaCreacion;
    this.#nombreRol = null;
  }

  // =====================================================================
  // GETTERS Y SETTERS
  // =====================================================================

  get id() {
    return this.#idUsuario;
  }

  set id(valor) {
    this.#idUsuario = valor;
  }

  get idRol() {
    return this.#idRol;
  }

  set idRol(valor) {
    this.#idRol = valor === null || valor === undefined ? null : Number(valor);
  }

  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    this.#nombre = typeof valor === 'string' ? valor.trim() : valor;
  }

  get apellido() {
    return this.#apellido;
  }

  set apellido(valor) {
    this.#apellido = typeof valor === 'string' ? valor.trim() : valor;
  }

  get email() {
    return this.#email;
  }

  /**
   * Recorta y pasa a minusculas.
   *
   * POR QUE MINUSCULAS?
   * Porque la UNICIDAD del correo depende de como se compare. Aunque
   * la colacion de MySQL insensible a mayusculas evitaria el duplicado
   * en la base, el service busca por correo exacto al hacer login:
   * normalizar de entrada hace que todas las comparaciones (login,
   * unicidad, perfil) sean consistentes.
   */
  set email(valor) {
    if (typeof valor === 'string') {
      this.#email = valor.trim().toLowerCase();
    } else {
      this.#email = valor;
    }
  }

  get telefono() {
    return this.#telefono;
  }

  set telefono(valor) {
    this.#telefono = typeof valor === 'string' ? valor.trim() : valor;
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  get fechaCreacion() {
    return this.#fechaCreacion === null ? null : fechas.aFechaHoraISO(this.#fechaCreacion);
  }

  set fechaCreacion(valor) {
    this.#fechaCreacion = valor;
  }

  /**
   * El hash sale SOLO por aqui cuando un repository lo necesita para
   * INSERTar o UPDATEar. NUNCA se expone en toJSON().
   */
  get contrasenaHash() {
    return this.#contrasenaHash;
  }

  set contrasenaHash(valor) {
    this.#contrasenaHash = valor;
  }

  /** Nombre completo para mostrar en la interfaz. */
  get nombreCompleto() {
    return `${this.#nombre} ${this.#apellido}`.trim();
  }

  get nombreRol() {
    return this.#nombreRol;
  }

  set nombreRol(valor) {
    this.#nombreRol = valor ?? null;
  }

  // =====================================================================
  // METODOS DE NEGOCIO
  // =====================================================================

  estaActivo() {
    return this.#estado === ESTADO.ACTIVO;
  }

  activar() {
    this.#estado = ESTADO.ACTIVO;
  }

  /** Baja logica: la cuenta deja de poder iniciar sesion. */
  desactivar() {
    this.#estado = ESTADO.INACTIVO;
  }

  /**
   * Cambia la contrase\u00f1a del usuario.
   *
   * @param {string} hash  Ya hasheada con bcrypt (nunca en claro).
   */
  cambiarContrasena(hash) {
    this.#contrasenaHash = hash;
  }

  /**
   * Comprueba si una contrase\u00f1a en claro coincide con la guardada.
   *
   * Devuelve true/false en NUNCA el hash: quien llama (el service de
   * login) solo necesita saber si coincide, no el secreto en si.
   *
   * @param {string} contrasenaEnClaro
   * @returns {Promise<boolean>}
   */
  async contrasenaCoincide(contrasenaEnClaro) {
    if (!this.#contrasenaHash) return false;
    return cifrado.verificarPassword(contrasenaEnClaro, this.#contrasenaHash);
  }

  // =====================================================================
  // FABRICAS ESTATICAS
  // =====================================================================

  /**
   * Fila de MySQL -> objeto Usuario.
   *
   * Acepta tambien un JOIN que traiga `nombre_rol` para mostrar en el
   * detalle; esa columna no se guarda en el objeto, solo se expone en
   * toJSON() si vino.
   *
   * @param {object} fila
   * @returns {Usuario|null}
   */
  static desdeFila(fila) {
    if (!fila) return null;

    const usuario = new Usuario(
      fila.id_usuario,
      fila.id_rol,
      fila.nombre,
      fila.apellido,
      fila.email,
      fila.contrasena_hash,
      fila.telefono,
      fila.estado,
      fila.fecha_creacion
    );

    // Solo el DETALLE trae el nombre del rol (JOIN); el listado puede
    // omitirlo y entonces no se expone.
    if (fila.nombre_rol !== undefined) {
      usuario.nombreRol = fila.nombre_rol ?? null;
    }

    return usuario;
  }

  /**
   * JSON ya normalizado por el service -> objeto Usuario.
   *
   * OJO: `contrasena` en claro NO debe llegar aqui. El service la
   * hashea primero y pasa `contrasenaHash`; asi ninguna fabrica puede
   * almacenar por accidente una contrase\u00f1a en claro.
   *
   * @param {object} datos
   * @returns {Usuario}
   */
  static desdeJSON(datos = {}) {
    return new Usuario(
      datos.id ?? datos.idUsuario ?? null,
      datos.idRol ?? null,
      datos.nombre ?? '',
      datos.apellido ?? '',
      datos.email ?? '',
      datos.contrasenaHash ?? null,
      datos.telefono ?? null,
      datos.estado ?? ESTADO.ACTIVO,
      datos.fechaCreacion ?? null
    );
  }

  // =====================================================================
  // SERIALIZACION
  // =====================================================================

  /**
   * Formato de fila para INSERT/UPDATE (snake_case).
   *
   * INCLUYE contrasena_hash porque la base lo exige como NOT NULL.
   * Solo quien persiste (el repository) debe ver este metodo.
   *
   * @returns {object}
   */
  aFilaBaseDatos() {
    return {
      id_rol: this.#idRol,
      nombre: this.#nombre,
      apellido: this.#apellido,
      email: this.#email,
      contrasena_hash: this.#contrasenaHash,
      telefono: this.#telefono,
      estado: this.#estado
    };
  }

  /**
   * JSON publico del usuario.
   *
   * CONTRASENA_HASH NO APARECE AQUI. Es la linea mas importante de
   * esta clase: exponerla filtraria el hash a cualquiera que consulte
   * el listado de usuarios.
   *
   * @returns {object}
   */
  toJSON() {
    const datos = {
      id: this.#idUsuario,
      idRol: this.#idRol,
      nombre: this.#nombre,
      apellido: this.#apellido,
      email: this.#email,
      telefono: this.#telefono,
      estado: this.#estado,
      activo: this.estaActivo(),
      fechaCreacion: this.fechaCreacion,
      nombreCompleto: this.nombreCompleto
    };

    // El nombre del rol solo se muestra si la consulta lo trajo (JOIN
    // en el detalle); en el listado queda fuera y no ensucia la respuesta.
    if (this.#nombreRol !== null) {
      datos.nombreRol = this.#nombreRol;
    }

    return datos;
  }
}

module.exports = Usuario;
