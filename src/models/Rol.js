/**
 * src/models/Rol.js
 * ---------------------------------------------------------------------
 * ENTIDAD Rol -> tabla `roles` de la base de datos.
 *
 * QUE ES UN MODELO EN ESTA ARQUITECTURA?
 * Una clase que representa una fila de la tabla como un OBJETO de
 * JavaScript. No sabe nada de SQL ni de HTTP: solo guarda datos y
 * expone comportamiento propio del dominio (tiene permisos, esta
 * activo, puede cambiar de estado).
 *
 * LOS CUATRO PILARES DE LA POO, APLICADOS AQUI:
 *
 *  1. ABSTRACCION     -> la clase describe que ES un rol, sin detalles
 *                        de como se guarda en MySQL.
 *  2. ENCAPSULAMIENTO -> los atributos llevan # (privados). Solo se
 *                        acceden por getters y setters. Nadie puede
 *                        hacer rol.#estado = 'basura' desde afuera.
 *  3. HERENCIA        -> no se usa aqui (ver utils/AppError.js, que si
 *                        hereda de Error). Cada modelo es autocontenido,
 *                        igual que el ejemplo del profesor.
 *  4. POLIMORFISMO    -> toJSON() y las fabricas estaticas: quien llama
 *                        no necesita saber como estan guardados los
 *                        atributos privados.
 *
 * POR QUE PRIVADOS CON # Y NO _nombre?
 * El guion bajo es solo una CONVENCION: nada impide tocar el atributo.
 * El numeral # es sintaxis real de JavaScript: si intentas leerlo
 * desde afuera, el programa lanza un SyntaxError. Es privacidad de
 * verdad, verificada por el motor del lenguaje.
 */

const fechas = require('../utils/fechas');
const { ESTADO } = require('../utils/constants');

class Rol {
  // ---- Declaracion de atributos privados ----
  // Se declaran arriba, fuera del constructor, para que la clase
  // documente de un vistazo que datos maneja.
  #id;
  #nombreRol;
  #descripcion;
  #estado;
  #fechaCreacion;

  // Relacion N:M con permisos (tabla rol_permiso).
  #permisos;

  // Conteo para la VISTA DE LISTADO.
  //
  // Por que guardar un conteo si ya tenemos el arreglo?
  // Porque GET /api/roles NO carga los permisos de cada rol: seria
  // carisimo traer los permisos de 20 roles solo para mostrar un
  // numero. El listado trae el conteo con una SUBCONSULTA
  // correlacionada; el DETALLE (GET /api/roles/:id) si carga el
  // arreglo. Un solo getter cubre los dos casos.
  #totalPermisos;

  /**
   * @param {number|null} id             Null cuando el rol aun no se guardo.
   * @param {string}      nombreRol      Unico en la base (uq_roles_nombre).
   * @param {string|null} descripcion
   * @param {string}      estado         'activo' | 'inactivo'
   * @param {string|null} fechaCreacion  Solo llega desde MySQL; el INSERT
   *                                     usa DEFAULT CURRENT_TIMESTAMP.
   */
  constructor(
    id = null,
    nombreRol,
    descripcion = null,
    estado = ESTADO.ACTIVO,
    fechaCreacion = null
  ) {
    this.#id = id;

    // Se asigna por SETTER y no por this.#nombreRol, para que la
    // normalizacion (recorte de espacios) aplique en TODOS los caminos
    // de creacion: constructor, desdeFila() y desdeJSON().
    this.nombreRol = nombreRol;
    this.descripcion = descripcion;

    this.#estado = estado;
    this.#fechaCreacion = fechaCreacion;

    this.#permisos = [];
    this.#totalPermisos = 0;
  }

  // =====================================================================
  // GETTERS Y SETTERS
  // ---------------------------------------------------------------------
  // Un getter se LEE como una propiedad: rol.nombreRol (sin parentesis),
  // aunque por dentro sea un metodo.
  //
  // Los setters son el lugar natural para normalizar y proteger el
  // estado del objeto.
  // =====================================================================

  get id() {
    return this.#id;
  }

  set id(valor) {
    this.#id = valor;
  }

  get nombreRol() {
    return this.#nombreRol;
  }

  /**
   * Recorta los espacios sobrantes.
   *
   * POR QUE ES NECESARIO?
   * La columna nombre_rol es UNIQUE. Si un cliente manda "  admin  "
   * y otro "admin", guardarian DOS filas distintas y el unico dejaria
   * de cumplir su proposito real (evitar nombres repetidos). Ademas,
   * "  " sin recortar se almacena y ensucia los listados.
   */
  set nombreRol(valor) {
    this.#nombreRol = typeof valor === 'string' ? valor.trim() : valor;
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

  get fechaCreacion() {
    // Siempre se devuelve en formato ISO, sin importar si por dentro
    // era un Date (MySQL) o un texto (JSON del cliente).
    return this.#fechaCreacion === null ? null : fechas.aFechaHoraISO(this.#fechaCreacion);
  }

  set fechaCreacion(valor) {
    this.#fechaCreacion = valor;
  }

  /**
   * Devuelve una COPIA del arreglo de permisos.
   *
   * Por que una copia y no el arreglo original?
   * Porque si devolvieramos la referencia, cualquiera podria hacer
   * `rol.permisos.push(basura)` y romper el encapsulamiento sin pasar
   * por agregarPermiso().
   */
  get permisos() {
    return [...this.#permisos];
  }

  /**
   * Cantidad de permisos del rol.
   *
   * Si las relaciones estan cargadas (detalle), el valor real es la
   * longitud del arreglo. Si no (listado), devolvemos el conteo que
   * trajo la subconsulta. Quien lo use no tiene que saber de donde
   * viene el dato: eso es encapsulamiento.
   */
  get totalPermisos() {
    return this.#permisos.length > 0 ? this.#permisos.length : this.#totalPermisos;
  }

  set totalPermisos(valor) {
    this.#totalPermisos = Number(valor) || 0;
  }

  // =====================================================================
  // METODOS DE NEGOCIO
  // Comportamiento que pertenece al rol mismo, no a la base de datos.
  // =====================================================================

  /** true si el rol esta activo (columna estado = 'activo'). */
  estaActivo() {
    return this.#estado === ESTADO.ACTIVO;
  }

  /** Marca el rol como activo. */
  activar() {
    this.#estado = ESTADO.ACTIVO;
  }

  /** Marca el rol como inactivo (baja logica, no se borra la fila). */
  desactivar() {
    this.#estado = ESTADO.INACTIVO;
  }

  /**
   * Agrega un objeto Permiso a la coleccion interna.
   *
   * Si el permiso ya estaba, no lo duplica: la tabla rol_permiso tiene
   * PK compuesta y un INSERT repetido romperia con un error de
   * restriccion. Evitarlo aqui da un mensaje entendible en vez de un
   * error de base de datos.
   *
   * @param {object} permiso  Instancia de Permiso
   * @returns {Rol} this, para poder encadenar llamadas.
   */
  agregarPermiso(permiso) {
    const yaExiste = this.#permisos.some((item) => item.id === permiso.id);

    if (!yaExiste) {
      this.#permisos.push(permiso);
      this.#totalPermisos = this.#permisos.length;
    }

    return this;
  }

  /**
   * Quita un permiso de la coleccion interna por su id.
   *
   * @param {number} idPermiso
   * @returns {boolean} true si se quito algo.
   */
  quitarPermiso(idPermiso) {
    const antes = this.#permisos.length;

    // filter devuelve un arreglo NUEVO sin el elemento; lo reasignamos
    // al atributo privado. Desde afuera esto no seria posible.
    this.#permisos = this.#permisos.filter((permiso) => permiso.id !== idPermiso);

    const seQuito = this.#permisos.length < antes;
    this.#totalPermisos = this.#permisos.length;

    return seQuito;
  }

  /**
   * Consulta si el rol tiene un permiso determinado.
   *
   * Se usa en la AUTORIZACION (fase 19): el middleware de permisos
   * pregunta rol.tienePermiso('roles.crear').
   *
   * @param {string} nombrePermiso
   * @returns {boolean}
   */
  tienePermiso(nombrePermiso) {
    return this.#permisos.some(
      (permiso) => permiso.nombrePermiso === nombrePermiso && permiso.estaActivo()
    );
  }

  /** Solo los permisos cuyo estado es 'activo'. */
  obtenerPermisosActivos() {
    return this.#permisos.filter((permiso) => permiso.estaActivo());
  }

  /**
   * true si el rol NO tiene ningun permiso activo.
   * Se valida antes de permitir que un rol quede sin permisos
   * (regla de negocio ROL_SIN_PERMISOS).
   *
   * @returns {boolean}
   */
  estaSinPermisos() {
    return this.totalPermisos === 0;
  }

  // =====================================================================
  // METODOS ESTATICOS (de fabrica)
  // ---------------------------------------------------------------------
  // Un metodo `static` pertenece a la CLASE, no a las instancias:
  //    Rol.desdeFila(fila)   <- correcto
  //    miRol.desdeFila(fila) <- NO existe
  //
  // Son "constructores con nombre": el constructor recibe varios
  // parametros en orden y equivocarse de posicion es facil. Estas
  // fabricas reciben un OBJETO con nombres y arman la instancia.
  // =====================================================================

  /**
   * Construye un Rol a partir de una fila de MySQL.
   * Traduce snake_case (nombre_rol) a camelCase (nombreRol).
   *
   * Este metodo es el "mapeador" entre el mundo de la base de datos y
   * el mundo de los objetos: es el UNICO lugar donde conviven
   * `nombre_rol` y `nombreRol`.
   *
   * @param {object} fila  Fila devuelta por el driver mysql2.
   * @returns {Rol|null}
   */
  static desdeFila(fila) {
    if (!fila) return null;

    const rol = new Rol(
      fila.id_rol,
      fila.nombre_rol,
      fila.descripcion,
      fila.estado,
      fila.fecha_creacion
    );

    // Columna que solo llega en el listado, desde la subconsulta
    // correlacionada. En el detalle no viene, y entonces el conteo se
    // deduce del arreglo ya cargado.
    if (fila.total_permisos !== undefined) {
      rol.totalPermisos = fila.total_permisos;
    }

    return rol;
  }

  /**
   * Construye un Rol a partir del JSON que envia el cliente
   * (req.body ya normalizado por el service).
   *
   * @param {object} datos  Objeto con llaves en camelCase.
   * @returns {Rol}
   */
  static desdeJSON(datos = {}) {
    return new Rol(
      datos.id ?? null,
      datos.nombreRol,
      datos.descripcion ?? null,
      datos.estado ?? ESTADO.ACTIVO,
      datos.fechaCreacion ?? null
    );
  }

  // =====================================================================
  // SERIALIZACION
  // =====================================================================

  /**
   * Convierte el objeto al formato de FILA que espera MySQL
   * (llaves en snake_case).
   *
   * NOTA: no incluimos `id` (es AUTO_INCREMENT en el INSERT y en el
   * UPDATE viaja aparte, en el WHERE) ni `fecha_creacion`:
   *   - en el INSERT lo pone DEFAULT CURRENT_TIMESTAMP;
   *   - en el UPDATE NO debe cambiar, es la fecha de creacion original.
   *
   * @returns {object}
   */
  aFilaBaseDatos() {
    return {
      nombre_rol: this.#nombreRol,
      descripcion: this.#descripcion,
      estado: this.#estado
    };
  }

  /**
   * Convierte el objeto al JSON que viaja al frontend.
   *
   * JSON.stringify() busca y llama este metodo de forma automatica.
   * Gracias a eso, el controlador puede hacer `res.json(rol)` y los
   * atributos PRIVADOS se publican de forma controlada: nosotros
   * decidimos exactamente que sale y que no.
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.#id,
      nombreRol: this.#nombreRol,
      descripcion: this.#descripcion,
      estado: this.#estado,
      activo: this.estaActivo(),
      fechaCreacion: this.fechaCreacion,
      totalPermisos: this.totalPermisos,
      // Serializacion en cascada: cada Permiso tiene su propio toJSON().
      permisos: this.#permisos.map((permiso) => permiso.toJSON())
    };
  }
}

module.exports = Rol;
