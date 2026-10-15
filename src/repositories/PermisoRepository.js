/**
 * src/repositories/PermisoRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de la tabla `permisos`.
 *
 * QUE VIVE AQUI Y QUE NO?
 * ---------------------------------------------------------------------
 *   SI vive aqui:  frases SELECT / INSERT / UPDATE / DELETE y el
 *                  mapeo fila -> objeto (Permiso.desdeFila).
 *   NO vive aqui:  validaciones, mensajes de error, reglas de negocio
 *                  (eso es el service) ni HTTP (eso es el controller).
 *
 *   Si este archivo crece y empieza a contener logica de "no se puede
 *   borrar si...", ese codigo se mueve al service.
 *
 * REGLAS QUE SIGUE (ejemplo del profesor)
 *   - R-ASYNC      : async/await sobre promesas. CERO callbacks (err, result).
 *   - Parametriza. : siempre `?`, nunca concatenar valores al SQL.
 *   - SELECT 1     : para comprobar existencias se pide `SELECT 1 AS existe`
 *                    y no `SELECT *` (leer todas las columnas es desperdicio).
 *   - Promise.all  : cuando dos consultas no dependen entre si, se piden
 *                    en paralelo y no una detras de otra.
 */

const db = require('../config/database');
const { Permiso } = require('../models');
const { Filtros, aLimites } = require('../utils/consulta');

class PermisoRepository {
  /**
   * Listado paginado con filtros OPCIONALES.
   *
   * @param {object}   opciones
   * @param {string}   [opciones.estado]    'activo' | 'inactivo' | null (todos)
   * @param {string}   [opciones.busqueda]  Texto parcial del nombre.
   * @param {number}   [opciones.pagina]    1 en adelante.
   * @param {number}   [opciones.limite]    Registros por pagina.
   * @returns {Promise<{ permisos: Permiso[], total: number }>}
   */
  async listar({ estado = null, busqueda = null, pagina = 1, limite = 20 } = {}) {
    const filtros = new Filtros();

    // Los dos filtros son opcionales: si no vienen, no se agregan y se
    // listan todos los permisos. El WHERE se arma SOLO con ?.
    filtros
      .agregarSi(estado, 'estado = ?', estado)
      .agregarBusqueda('nombre_permiso', busqueda);

    const where = filtros.obtenerWhere();
    const parametros = filtros.obtenerParametros();
    const { limite: porPagina, offset } = aLimites(pagina, limite);

    // Total y pagina se piden en PARALELO: el conteo no depende de las
    // filas ni al reves. Promise.all lanza el primer error que ocurra
    // y capturarAsync lo deriva al manejador central.
    const [total, filas] = await Promise.all([
      this.#contar(where, parametros),
      db.ejecutar(
        `SELECT id_permiso, nombre_permiso, descripcion, estado
           FROM permisos
           ${where}
          ORDER BY nombre_permiso ASC
          LIMIT ? OFFSET ?`,
        [...parametros, porPagina, offset]
      )
    ]);

    return {
      permisos: filas.map((fila) => Permiso.desdeFila(fila)),
      total
    };
  }

  /**
   * Busca un permiso por su id.
   *
   * @param {number} id
   * @returns {Promise<Permiso|null>} null si no existe (el controller
   *                                  decide si eso es un 404).
   */
  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `SELECT id_permiso, nombre_permiso, descripcion, estado
         FROM permisos
        WHERE id_permiso = ?`,
      [id]
    );

    return Permiso.desdeFila(fila);
  }

  /**
   * Comprueba si YA EXISTE un permiso con ese nombre.
   *
   * Se usa antes de crear y antes de editar, para responder 409
   * Conflicto en lugar de dejar que MySQL falle con ER_DUP_ENTRY
   * (error interno poco claro para quien usa la API).
   *
   * @param {string}     nombre
   * @param {number|null} [idExcluido]  En EDICION se excluye el propio
   *                                    registro, o sino siempre chocaria
   *                                    consigo mismo.
   * @returns {Promise<boolean>}
   */
  async existeNombre(nombre, idExcluido = null) {
    const filtros = new Filtros();
    filtros
      .agregar('nombre_permiso = ?', nombre)
      .agregarSi(idExcluido, 'id_permiso <> ?', idExcluido);

    const fila = await db.obtenerUno(
      `SELECT 1 AS existe
         FROM permisos
         ${filtros.obtenerWhere()}
        LIMIT 1`,
      filtros.obtenerParametros()
    );

    // obtenerUno devuelve null cuando no hubo coincidencia.
    return fila !== null;
  }

  /**
   * Cantidad de roles que tienen asignado este permiso (tabla puente
   * rol_permiso). El service lo usa para decidir si se puede eliminar.
   *
   * @param {number} idPermiso
   * @returns {Promise<number>}
   */
  async contarRolesAsignados(idPermiso) {
    const fila = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM rol_permiso
        WHERE id_permiso = ?`,
      [idPermiso]
    );

    // COUNT siempre devuelve una fila; Number() por si llega como texto.
    return Number(fila?.total ?? 0);
  }

  /**
   * Inserta un permiso y devuelve su id.
   *
   * No se incluye fecha: la tabla no tiene esa columna.
   *
   * @param {Permiso} permiso
   * @returns {Promise<number>} El id_autogenerado.
   */
  async crear(permiso) {
    // El modelo traduce camelCase -> snake_case en un solo lugar.
    const fila = permiso.aFilaBaseDatos();

    const resultado = await db.ejecutar(
      `INSERT INTO permisos (nombre_permiso, descripcion, estado)
       VALUES (?, ?, ?)`,
      [fila.nombre_permiso, fila.descripcion, fila.estado]
    );

    // mysql2 devuelve un OkPacket con insertId para los INSERT.
    return resultado.insertId;
  }

  /**
   * Actualiza todos los campos editables de un permiso.
   *
   * @param {number} id
   * @param {Permiso} permiso
   * @returns {Promise<boolean>} true si se modifico una fila.
   */
  async actualizar(id, permiso) {
    const fila = permiso.aFilaBaseDatos();

    const resultado = await db.ejecutar(
      `UPDATE permisos
          SET nombre_permiso = ?,
              descripcion    = ?,
              estado         = ?
        WHERE id_permiso = ?`,
      [fila.nombre_permiso, fila.descripcion, fila.estado, id]
    );

    // affectedRows es 0 cuando el id no existia o cuando los valores
    // eran identicos a los ya guardados.
    return resultado.affectedRows > 0;
  }

  /**
   * Cambia SOLO el estado (activo/inactivo).
   *
   * Por que un metodo aparte de actualizar()?
   *   Porque es la operacion mas usada (baja logica) y hacerla separada
   *   evita que un cliente mande un PUT completo y por error pise el
   *   nombre o la descripcion de otro rol.
   *
   * @param {number} id
   * @param {string} estado  'activo' | 'inactivo'
   * @returns {Promise<boolean>}
   */
  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      `UPDATE permisos
          SET estado = ?
        WHERE id_permiso = ?`,
      [estado, id]
    );

    return resultado.affectedRows > 0;
  }

  /**
   * Elimina fisicamente el permiso.
   *
   * La tabla puente rol_permiso declara ON DELETE CASCADE, asi que al
   * borrar el permiso MySQL quita tambien sus asignaciones a roles.
   * Por eso el service DEBE llamar antes a contarRolesAsignados() y
   * rechazar con 409 si esta en uso.
   *
   * @param {number} id
   * @returns {Promise<boolean>} true si se borro.
   */
  async eliminar(id) {
    const resultado = await db.ejecutar(
      `DELETE FROM permisos WHERE id_permiso = ?`,
      [id]
    );

    return resultado.affectedRows > 0;
  }

  // ------------------------------------------------------------------
  // Consultas privadas (solo se usan dentro de esta clase)
  // ------------------------------------------------------------------

  /**
   * Cuenta los registros que coinciden con los filtros dados.
   * Se marca con # para que ningun otro archivo pueda llamarla: es un
   * detalle interno del listado.
   *
   * @param {string} where       '' o 'WHERE ...' ya construido.
   * @param {Array}  parametros  Valores de ese WHERE.
   * @returns {Promise<number>}
   */
  async #contar(where, parametros) {
    const fila = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM permisos
         ${where}`,
      parametros
    );

    return Number(fila?.total ?? 0);
  }
}

// ---------------------------------------------------------------------
// SINGLETON: se exporta una INSTANCIA, no la clase.
// Node.js cachea los require(), de modo que todos los archivos que
// importen este repositorio comparten el mismo objeto.
// ---------------------------------------------------------------------
module.exports = new PermisoRepository();
