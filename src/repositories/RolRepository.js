/**
 * src/repositories/RolRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de la tabla `roles`.
 *
 * AQUI VIVE: SQL de roles + el mapeo fila -> Rol.
 * NO VIVE:  validaciones ni reglas ("nombre unico", "no borrar si hay
 *           usuarios"): eso lo decide el service.
 *
 * DETALLE DEL LISTADO: la subconsulta de abajo
 * ---------------------------------------------------------------------
 * El listado trae `total_permisos` con una SUBCONSULTA CORRELACIONADA
 * en lugar de un JOIN. Con un JOIN, un rol con 15 permisos apareceria
 * 15 veces en el resultado y habria que agrupar y contar a mano. La
 * subconsulta calcula el numero por fila sin multiplicar filas.
 *
 * La subconsulta es barata porque `rol_permiso` tiene indice en
 * `id_rol` (es su PRIMARY KEY).
 */

const db = require('../config/database');
const { Rol } = require('../models');
const { Filtros, aLimites } = require('../utils/consulta');

class RolRepository {
  /**
   * Listado paginado con filtros OPCIONALES.
   *
   * @param {object}   opciones
   * @param {string}   [opciones.estado]    'activo' | 'inactivo' | null
   * @param {string}   [opciones.busqueda]  Texto parcial del nombre.
   * @param {number}   [opciones.pagina]
   * @param {number}   [opciones.limite]
   * @returns {Promise<{ roles: Rol[], total: number }>}
   */
  async listar({ estado = null, busqueda = null, pagina = 1, limite = 20 } = {}) {
    const filtros = new Filtros();

    // OJO: las clausulas van SIN alias (`estado`, no `r.estado`) porque
    // Filtros.agregarBusqueda exige una columna de un solo segmento y
    // aqui solo hay una tabla en el FROM.
    filtros
      .agregarSi(estado, 'estado = ?', estado)
      .agregarBusqueda('nombre_rol', busqueda);

    const where = filtros.obtenerWhere();
    const parametros = filtros.obtenerParametros();
    const { limite: porPagina, offset } = aLimites(pagina, limite);

    const [total, filas] = await Promise.all([
      this.#contar(where, parametros),
      db.ejecutar(
        `SELECT r.id_rol, r.nombre_rol, r.descripcion, r.estado, r.fecha_creacion,
                (SELECT COUNT(*)
                   FROM rol_permiso rp
                  WHERE rp.id_rol = r.id_rol) AS total_permisos
           FROM roles r
           ${where}
          ORDER BY r.nombre_rol ASC
          LIMIT ? OFFSET ?`,
        [...parametros, porPagina, offset]
      )
    ]);

    return {
      roles: filas.map((fila) => Rol.desdeFila(fila)),
      total
    };
  }

  /**
   * Busca un rol por id (SIN sus permisos: eso lo hace
   * RolPermisoRepository, que es quien posee la tabla puente).
   *
   * @param {number} id
   * @returns {Promise<Rol|null>}
   */
  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `SELECT id_rol, nombre_rol, descripcion, estado, fecha_creacion
         FROM roles
        WHERE id_rol = ?`,
      [id]
    );

    return Rol.desdeFila(fila);
  }

  /**
   * Rol por su nombre (unico en la base).
   *
   * Lo necesita el registro PUBLICO de auth: alli no se pide idRol
   * (el cliente no debe elegir su propio rol), sino que se asigna el
   * rol por defecto `cliente` buscandolo por nombre.
   *
   * @param {string} nombre
   * @returns {Promise<Rol|null>}
   */
  async obtenerPorNombre(nombre) {
    const fila = await db.obtenerUno(
      `SELECT id_rol, nombre_rol, descripcion, estado, fecha_creacion
         FROM roles
        WHERE nombre_rol = ?
        LIMIT 1`,
      [nombre]
    );

    return Rol.desdeFila(fila);
  }

  /**
   * Comprueba si YA EXISTE un rol con ese nombre (409 en el service).
   *
   * El nombre es UNIQUE en la base, asi que esta consulta es el aviso
   * AMABLE: sin ella, MySQL devolveria ER_DUP_ENTRY y el cliente veria
   * un error de base de datos en vez de un 409 entendible.
   *
   * @param {string}      nombre
   * @param {number|null} [idExcluido]  Se ignora al editar.
   * @returns {Promise<boolean>}
   */
  async existeNombre(nombre, idExcluido = null) {
    const filtros = new Filtros();
    filtros
      .agregar('nombre_rol = ?', nombre)
      .agregarSi(idExcluido, 'id_rol <> ?', idExcluido);

    const fila = await db.obtenerUno(
      `SELECT 1 AS existe
         FROM roles
         ${filtros.obtenerWhere()}
        LIMIT 1`,
      filtros.obtenerParametros()
    );

    return fila !== null;
  }

  /**
   * Cuenta los usuarios que usan este rol (columna usuarios.id_rol).
   * El service lo consulta antes de borrar para responder 409 ROL_EN_USO.
   *
   * @param {number} idRol
   * @returns {Promise<number>}
   */
  async contarUsuariosAsignados(idRol) {
    const fila = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM usuarios
        WHERE id_rol = ?`,
      [idRol]
    );

    return Number(fila?.total ?? 0);
  }

  /**
   * Inserta un rol y devuelve su id.
   *
   * No se envia fecha_creacion: la columna tiene DEFAULT
   * CURRENT_TIMESTAMP, y quien fija la hora es la base, no la app.
   *
   * @param {Rol} rol
   * @returns {Promise<number>}
   */
  async crear(rol) {
    const fila = rol.aFilaBaseDatos();

    const resultado = await db.ejecutar(
      `INSERT INTO roles (nombre_rol, descripcion, estado)
       VALUES (?, ?, ?)`,
      [fila.nombre_rol, fila.descripcion, fila.estado]
    );

    return resultado.insertId;
  }

  /**
   * Actualiza los campos editables de un rol.
   *
   * fecha_creacion NO se incluye a proposito: es inmutable, seguiria
   * siendo la fecha en que el rol nacio aunque lo editemos.
   *
   * @param {number} id
   * @param {Rol}    rol
   * @returns {Promise<boolean>}
   */
  async actualizar(id, rol) {
    const fila = rol.aFilaBaseDatos();

    const resultado = await db.ejecutar(
      `UPDATE roles
          SET nombre_rol = ?,
              descripcion = ?,
              estado     = ?
        WHERE id_rol = ?`,
      [fila.nombre_rol, fila.descripcion, fila.estado, id]
    );

    return resultado.affectedRows > 0;
  }

  /**
   * Cambia SOLO el estado (baja o alta logica).
   *
   * @param {number} id
   * @param {string} estado  'activo' | 'inactivo'
   * @returns {Promise<boolean>}
   */
  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      `UPDATE roles SET estado = ? WHERE id_rol = ?`,
      [estado, id]
    );

    return resultado.affectedRows > 0;
  }

  /**
   * Elimina fisicamente el rol.
   *
   * Al borrar el rol, MySQL elimina en CASCADA sus filas en
   * `rol_permiso` (ON DELETE CASCADE). Por eso el service DEBE avisar
   * antes con 409 si hay usuarios que dependen de el.
   *
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async eliminar(id) {
    const resultado = await db.ejecutar(`DELETE FROM roles WHERE id_rol = ?`, [id]);

    return resultado.affectedRows > 0;
  }

  // ------------------------------------------------------------------
  // Privadas
  // ------------------------------------------------------------------

  /**
   * @param {string} where
   * @param {Array}  parametros
   * @returns {Promise<number>}
   */
  async #contar(where, parametros) {
    const fila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM roles ${where}`,
      parametros
    );

    return Number(fila?.total ?? 0);
  }
}

// SINGLETON: una instancia compartida por toda la aplicacion.
module.exports = new RolRepository();
