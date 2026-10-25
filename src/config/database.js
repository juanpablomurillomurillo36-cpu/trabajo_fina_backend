/**
 * src/config/database.js
 * ---------------------------------------------------------------------
 * Clase Database: unico punto de acceso a MySQL en toda la aplicacion.
 *
 * CONCEPTOS QUE SE APLICAN AQUI
 *
 * 1. POOL DE CONEXIONES
 *    Abrir una conexion a MySQL es costoso (handshake, autenticacion).
 *    El pool abre un grupo de conexiones una sola vez y las presta y
 *    recoge segun la demanda. Es como una fila de cajeros en un banco:
 *    el cliente no contrata un cajerito nuevo, usa uno libre.
 *
 * 2. SINGLETON
 *    Exportamos UNA instancia ya creada, no la clase. Asi, por mas
 *    archivos que hagan require() de este modulo, todos comparten el
 *    mismo pool. Node.js cachea los modulos, de modo que el codigo de
 *    abajo se ejecuta una sola vez en la vida del proceso.
 *
 * 3. CONSULTAS PARAMETRIZADAS (prepared statements)
 *    JAMAS se concatena texto del cliente en una consulta SQL:
 *
 *       MAL:  `SELECT * FROM roles WHERE id_rol = ${id}`
 *       BIEN: 'SELECT * FROM roles WHERE id_rol = ?'  +  [id]
 *
 *    En la version mala, si id vale "1 OR 1=1" el atacante lee toda la
 *    tabla. Eso es una INYECCION SQL. Con el signo ? el driver envia
 *    el valor por separado y MySQL lo trata SIEMPRE como dato, nunca
 *    como codigo.
 *
 * 4. ENCAPSULAMIENTO
 *    El pool es un atributo PRIVADO (#pool). Ningun service puede
 *    tocarlo directo; solo puede llamar a los metodos publicos
 *    ejecutar(), obtenerUno(), conTransaccion() y cerrar().
 */

const mysql = require('mysql2/promise');
const config = require('./env');

class Database {
  // ---- Atributos privados (el # los hace inaccesibles desde afuera) ----
  #pool;
  #estaConectada;

  constructor() {
    this.#pool = null;
    this.#estaConectada = false;
  }

  // ---------------------------- Getters ----------------------------

  /** true si ya se verifico la conexion con la base de datos. */
  get estaConectada() {
    return this.#estaConectada;
  }

  /**
   * Devuelve el pool, creandolo la primera vez que se necesita
   * (patron "lazy initialization" o inicializacion perezosa).
   */
  get pool() {
    if (this.#pool === null) {
      this.#crearPool();
    }
    return this.#pool;
  }

  // ----------------------- Metodos privados ------------------------

  /**
   * Crea el pool de conexiones con la configuracion del archivo .env.
   * Metodo privado: solo se puede llamar desde dentro de la clase.
   */
  #crearPool() {
    this.#pool = mysql.createPool({
      host: config.baseDatos.host,
      port: config.baseDatos.puerto,
      user: config.baseDatos.usuario,
      password: config.baseDatos.clave,
      database: config.baseDatos.nombre,

      // waitForConnections: si todas las conexiones estan ocupadas,
      // la peticion espera en cola en vez de fallar de inmediato.
      waitForConnections: true,

      // Maximo de conexiones simultaneas.
      connectionLimit: config.baseDatos.limiteConexiones,

      // 0 = la cola de espera es ilimitada.
      queueLimit: 0,

      // Soporte de acentos, eñes y emojis.
      charset: 'utf8mb4',

      // 'local' hace que los DATETIME se interpreten en la zona
      // horaria del equipo. Debe coincidir con lo que hace
      // utils/fechas.js para que una fecha de las 22:00 no se corra.
      timezone: 'local',

      // Devuelve DECIMAL como texto para no perder precision con el
      // dinero (16.50 no debe convertirse en 16.49999999).
      decimalNumbers: false
    });
  }

  // ------------------------ Metodos publicos -----------------------

  /**
   * Comprueba que la base de datos responda. Se llama al arrancar el
   * servidor para fallar temprano si MySQL esta apagado.
   *
   * @returns {Promise<boolean>}
   */
  async verificarConexion() {
    // getConnection() toma prestada una conexion del pool.
    const conexion = await this.pool.getConnection();

    try {
      // ping() envia un paquete minimo al servidor y espera respuesta.
      await conexion.ping();
      this.#estaConectada = true;
      return true;
    } finally {
      // El bloque finally SIEMPRE se ejecuta, con error o sin error.
      // release() devuelve la conexion al pool. Si se olvida esta
      // linea, el pool se agota y la aplicacion se congela.
      conexion.release();
    }
  }

  /**
   * Ejecuta una consulta parametrizada y devuelve las filas.
   *
   * Usamos execute() y no query() porque execute() usa prepared
   * statements del lado del servidor: MySQL compila la consulta una
   * vez y la reutiliza, lo que da mas seguridad y mas velocidad.
   *
   * @param {string} sql         Consulta con marcadores ?
   * @param {Array}  parametros  Valores que reemplazan a cada ?
   * @returns {Promise<Array>}   Filas (SELECT) o metadatos (INSERT/UPDATE).
   *
   * @example
   *   const filas = await db.ejecutar(
   *     'SELECT * FROM roles WHERE estado = ?',
   *     ['activo']
   *   );
   */
  async ejecutar(sql, parametros = []) {
    // mysql2 devuelve [filas, camposMetadata]; solo necesitamos filas.
    const [filas] = await this.pool.execute(sql, parametros);
    return filas;
  }

  /**
   * Ejecuta una consulta y devuelve SOLO la primera fila, o null.
   * Evita escribir `filas[0] ?? null` en cada service.
   *
   * @param {string} sql
   * @param {Array} parametros
   * @returns {Promise<object|null>}
   */
  async obtenerUno(sql, parametros = []) {
    const filas = await this.ejecutar(sql, parametros);

    // Array.isArray protege el caso de un INSERT, que no devuelve filas.
    if (!Array.isArray(filas) || filas.length === 0) {
      return null;
    }

    return filas[0];
  }

  /**
   * Ejecuta varias operaciones dentro de una TRANSACCION.
   *
   * Una transaccion es un bloque "todo o nada". Si cualquier paso
   * falla, se deshacen TODOS los anteriores (rollback) y la base de
   * datos queda exactamente como estaba.
   *
   * Caso real de esta API: al asignar un permiso a un rol hay que
   * INSERTAR en la tabla puente y luego RECONTAR. Si el recuento
   * fallara a mitad de camino, no queremos una fila huerfana en
   * rol_permiso.
   *
   * @param {function} trabajo  Funcion async que recibe la conexion.
   * @returns {Promise<*>}      Lo que devuelva la funcion `trabajo`.
   *
   * @example
   *   await db.conTransaccion(async (conexion) => {
   *     await conexion.execute('DELETE FROM detalle WHERE id = ?', [id]);
   *     await conexion.execute('DELETE FROM cabecera WHERE id = ?', [id]);
   *   });
   */
  async conTransaccion(trabajo) {
    const conexion = await this.pool.getConnection();

    try {
      // A partir de aqui nada se guarda de forma definitiva.
      await conexion.beginTransaction();

      // Le pasamos la conexion para que TODAS las consultas del bloque
      // viajen por la MISMA conexion. Si usaramos el pool, cada
      // consulta podria tomar una conexion distinta y la transaccion
      // no cubriria nada.
      const resultado = await trabajo(conexion);

      // Si llegamos aqui no hubo errores: confirmamos los cambios.
      await conexion.commit();

      return resultado;
    } catch (error) {
      // Algo fallo: deshacemos todo lo hecho desde beginTransaction.
      await conexion.rollback();

      // Relanzamos el error para que lo atrape el middleware.
      throw error;
    } finally {
      // Pase lo que pase, devolvemos la conexion al pool.
      conexion.release();
    }
  }

  /**
   * Cierra todas las conexiones del pool.
   * Se llama al apagar el servidor (apagado elegante o graceful shutdown).
   *
   * @returns {Promise<void>}
   */
  async cerrar() {
    if (this.#pool !== null) {
      await this.#pool.end();
      this.#pool = null;
      this.#estaConectada = false;
    }
  }
}

// ---------------------------------------------------------------------
// SINGLETON: exportamos una INSTANCIA, no la clase.
// Node.js guarda en cache el resultado de cada require(), por eso
// `new Database()` corre una sola vez en toda la vida del proceso.
// ---------------------------------------------------------------------
module.exports = new Database();
