/**
 * src/services/rol.service.js
 * ---------------------------------------------------------------------
 * CAPA DE SERVICE de la entidad Rol.
 *
 * El rol es el centro del sistema de permisos: un USUARIO tiene un
 * ROL, y un ROL tiene muchos PERMISOS (relacion N:M a traves de la
 * tabla puente `rol_permiso`). De ahi que este archivo tenga, ademas
 * del CRUD normal, los dos metodos de asignacion de permisos.
 *
 * TABLA `roles`
 * ---------------------------------------------------------------------
 *   id_rol         INT PK AUTO_INCREMENT
 *   nombre_rol     VARCHAR(50) NOT NULL UNIQUE
 *   descripcion    VARCHAR(255) NULL
 *   estado         ENUM('activo','inactivo') DEFAULT 'activo'
 *   fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
 *
 * TABLA PUENTE `rol_permiso` (N:M)
 * ---------------------------------------------------------------------
 *   id_rol, id_permiso  -> PK compuesta, ambas FK con ON DELETE CASCADE
 *
 * La cascada es importante: al borrar un rol, MySQL borra solo las
 * filas puente y no deja huerfanos.
 */

const db = require('../config/database');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const { Rol, Permiso } = require('../models');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES, SEGURIDAD } = require('../utils/constants');
const {
  limpiarTexto,
  soloCamposPermitidos,
  normalizarPaginacion
} = require('../utils/formato');

/**
 * Columnas del rol, usadas en casi todas las consultas. Declararla
 * arriba evita repetir la lista en cinco metodos distintos y hace que
 * agregar una columna sea un solo cambio.
 */
const COLUMNAS_ROL = 'r.id_rol, r.nombre_rol, r.descripcion, r.estado, r.fecha_creacion';

/**
 * Subconsulta correlacionada que trae el CONTEO de permisos de cada
 * rol.
 *
 * POR QUE UNA SUBCONSULTA Y NO UN JOIN?
 * Porque un JOIN multiplicaria las filas: un rol con 10 permisos
 * saldria 10 veces en el listado y habria que agrupar y contar igual.
 * Con la subconsulta, cada fila de `roles` sale UNA sola vez ya con
 * su conteo. Evita ademas el problema N+1 (una consulta por rol).
 */
const CONTEO_PERMISOS =
  '(SELECT COUNT(*) FROM rol_permiso rp WHERE rp.id_rol = r.id_rol) AS total_permisos';

/**
 * SQL que trae los permisos de UN rol, con sus columnas de permiso.
 */
const SQL_PERMISOS_DEL_ROL = `
  SELECT p.id_permiso, p.nombre_permiso, p.descripcion, p.estado
    FROM rol_permiso rp
    INNER JOIN permisos p ON p.id_permiso = rp.id_permiso
   WHERE rp.id_rol = ?
   ORDER BY p.nombre_permiso`;

class RolService {
  #camposPermitidos = ['nombreRol', 'descripcion', 'estado'];

  // =================================================================
  // LISTADO
  // ================================================================

  /**
   * Lista roles con filtros y paginacion.
   *
   * Filtros: ?estado=activo & busqueda=adm & pagina=1 & limite=20
   *
   * @param {object} filtros
   * @returns {Promise<{roles: Rol[], total: number, pagina: number, limite: number}>}
   */
  async listar(filtros = {}) {
    const { pagina, limite, desplazamiento } = normalizarPaginacion(
      filtros,
      LIMITES.LIMITE_DEFECTO,
      LIMITES.LIMITE_PAGINA
    );

    const condiciones = [];
    const parametros = [];

    if (filtros.estado) {
      const estado = limpiarTexto(String(filtros.estado));

      if (Object.values(ESTADO).includes(estado)) {
        condiciones.push('r.estado = ?');
        parametros.push(estado);
      }
    }

    if (filtros.busqueda && limpiarTexto(String(filtros.busqueda)) !== '') {
      const texto = limpiarTexto(String(filtros.busqueda));
      const patron = `%${texto.replace(/[%_]/g, '\\$&')}%`;

      condiciones.push('(r.nombre_rol LIKE ? OR r.descripcion LIKE ?)');
      parametros.push(patron, patron);
    }

    const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const filaTotal = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM roles r ${donde}`,
      parametros
    );
    const total = Number(filaTotal?.total ?? 0);

    // LIMIT/OFFSET: enteros ya acotados por normalizarPaginacion.
    const filas = await db.ejecutar(
      `SELECT ${COLUMNAS_ROL}, ${CONTEO_PERMISOS}
         FROM roles r
         ${donde}
        ORDER BY r.nombre_rol
        LIMIT ${limite} OFFSET ${desplazamiento}`,
      parametros
    );

    return {
      roles: filas.map((fila) => Rol.desdeFila(fila)),
      total,
      pagina,
      limite
    };
  }

  // =================================================================
  // DETALLE
  // ================================================================

  /**
   * Busca un rol por id CARGANDO SU ARREGLO DE PERMISOS.
   *
   * En el listado NO se hace esto (seria una consulta por cada rol);
   * aca, en cambio, el cliente pidio UN rol y quiere ver todo.
   *
   * @param {number} id
   * @returns {Promise<Rol>}
   * @throws {AppError} 404 si no existe.
   */
  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `SELECT ${COLUMNAS_ROL}, ${CONTEO_PERMISOS}
         FROM roles r
        WHERE r.id_rol = ?`,
      [id]
    );

    if (fila === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.ROL_NO_EXISTE(id));
    }

    const rol = Rol.desdeFila(fila);

    // Carga perezosa de la relacion N:M.
    const permisos = await db.ejecutar(SQL_PERMISOS_DEL_ROL, [id]);

    for (const filaPermiso of permisos) {
      rol.agregarPermiso(Permiso.desdeFila(filaPermiso));
    }

    return rol;
  }

  // =================================================================
  // CREACION
  // ================================================================

  /**
   * Crea un rol nuevo.
   *
   * @param {object} datos  req.body con nombreRol, descripcion, estado.
   * @returns {Promise<Rol>}
   * @throws {AppError} 400 datos invalidos, 409 nombre duplicado.
   */
  async crear(datos) {
    const entrada = soloCamposPermitidos(datos, this.#camposPermitidos);

    const rol = this.#validar(entrada);

    await this.#asegurarNombreUnico(rol.nombreRol, null);

    const resultado = await db.ejecutar(
      'INSERT INTO roles (nombre_rol, descripcion, estado) VALUES (?, ?, ?)',
      [rol.nombreRol, rol.descripcion, rol.estado]
    );

    return this.obtenerPorId(resultado.insertId);
  }

  // =================================================================
  // ACTUALIZACION
  // ================================================================

  /**
   * Actualizacion PARCIAL: solo se modifican los campos que llegaron.
   *
   * @param {number} id
   * @param {object} datos
   * @returns {Promise<Rol>}
   */
  async actualizar(id, datos) {
    const existente = await this.obtenerPorId(id);

    const entrada = soloCamposPermitidos(datos, this.#camposPermitidos);

    if (Object.keys(entrada).length === 0) {
      throw AppError.cuerpoInvalido(
        'La peticion no incluye ningun campo actualizable. Se admiten: ' +
          this.#camposPermitidos.join(', ')
      );
    }

    const paraValidar = {
      nombreRol: entrada.nombreRol ?? existente.nombreRol,
      descripcion: entrada.descripcion ?? existente.descripcion,
      estado: entrada.estado ?? existente.estado
    };

    const rol = this.#validar(paraValidar);

    if (rol.nombreRol !== existente.nombreRol) {
      await this.#asegurarNombreUnico(rol.nombreRol, id);
    }

    await db.ejecutar(
      'UPDATE roles SET nombre_rol = ?, descripcion = ?, estado = ? WHERE id_rol = ?',
      [rol.nombreRol, rol.descripcion, rol.estado, id]
    );

    return this.obtenerPorId(id);
  }

  // =================================================================
  // CAMBIO DE ESTADO (PATCH)
  // ================================================================

  /**
   * Baja o subida logica del rol.
   *
   * IMPORTANTE: desactivar un rol NO borra sus permisos ni lo quita
   * de los usuarios. Solo dice "este rol ya no se asigna ni inicia
   * sesion". Es la reversibilidad que exige la regla de negocio.
   *
   * @param {number} id
   * @param {string} estado
   * @returns {Promise<Rol>}
   */
  async cambiarEstado(id, estado) {
    await this.obtenerPorId(id);

    const errores = new ColectorErrores();
    errores.exigirValorDeLista('estado', estado, Object.values(ESTADO));
    errores.lanzarSiHayErrores();

    await db.ejecutar('UPDATE roles SET estado = ? WHERE id_rol = ?', [estado, id]);

    return this.obtenerPorId(id);
  }

  // =================================================================
  // ELIMINACION
  // ================================================================

  /**
   * Elimina un rol.
   *
   * El borrado de `rol_permiso` lo hace MySQL solo (ON DELETE CASCADE).
   * Lo que NO se permite es borrar un rol que todavia tenga USUARIOS:
   * `usuarios.id_rol` no tiene cascada, asi que MySQL responde con
   * ER_ROW_IS_REFERENCED y el middleware la traduce a 409.
   *
   * @param {number} id
   * @returns {Promise<object>}
   */
  async eliminar(id) {
    const existente = await this.obtenerPorId(id);

    await db.ejecutar('DELETE FROM roles WHERE id_rol = ?', [id]);

    return {
      idEliminado: existente.id,
      nombreRol: existente.nombreRol,
      permisosLiberados: existente.totalPermisos,
      mensaje: 'Rol eliminado junto con sus asignaciones de permisos'
    };
  }

  // =================================================================
  // ASIGNACION DE PERMISOS (sub-recurso N:M)
  // ================================================================

  /**
   * Asigna un permiso a un rol.
   *
   * Se ejecuta dentro de UNA TRANSACCION porque son dos escrituras
   * (INSERT en la puente) mas una lectura de comprobacion. Si algo
   * falla en el medio, no queremos una fila puente sin validar.
   *
   * REGLA: el estado del rol NO se mira. En la secuencia de Postman
   * el rol recien creado se pone "inactivo" con un PATCH y AUN ASI
   * se le siguen asignando permisos; bloquearlo ahi haria fallar una
   * operacion perfectamente razonable (preparar un rol antes de
   * activarlo).
   *
   * @param {number} idRol
   * @param {number} idPermiso
   * @returns {Promise<Rol>} El rol con su arreglo de permisos actualizado.
   * @throws {AppError} 404 si no existe el rol o el permiso, 409 si ya
   *                    estaba asignado.
   */
  async asignarPermiso(idRol, idPermiso) {
    // Antes de abrir la transaccion se valida el id que llega en el
    // cuerpo: si no es un entero valido no tiene sentido gastar una
    // conexion de base de datos para descubrirlo.
    const errores = new ColectorErrores();
    errores.exigirEntero('idPermiso', idPermiso, { minimo: 1 });
    errores.lanzarSiHayErrores();

    await db.conTransaccion(async (conexion) => {
      const [roles] = await conexion.execute('SELECT id_rol FROM roles WHERE id_rol = ?', [idRol]);

      if (roles.length === 0) {
        throw AppError.noEncontrado(MENSAJES.NEGOCIO.ROL_NO_EXISTE(idRol));
      }

      const [permisos] = await conexion.execute(
        'SELECT id_permiso FROM permisos WHERE id_permiso = ?',
        [idPermiso]
      );

      if (permisos.length === 0) {
        throw AppError.noEncontrado(MENSAJES.NEGOCIO.PERMISO_NO_EXISTE(idPermiso));
      }

      const [yaAsignado] = await conexion.execute(
        'SELECT id_rol FROM rol_permiso WHERE id_rol = ? AND id_permiso = ?',
        [idRol, idPermiso]
      );

      if (yaAsignado.length > 0) {
        // La PK compuesta impediria el duplicado, pero el error de
        // MySQL llegaria como ER_DUP_ENTRY (409 generico). Detectandolo
        // aqui el cliente recibe un mensaje que explica QUE paso.
        throw AppError.conflicto(MENSAJES.NEGOCIO.PERMISO_YA_ASIGNADO);
      }

      await conexion.execute(
        'INSERT INTO rol_permiso (id_rol, id_permiso) VALUES (?, ?)',
        [idRol, idPermiso]
      );
    });

    // Se reconsulta el rol completo para devolver totalPermisos
    // actualizado, que es lo que exige el contrato de respuesta.
    return this.obtenerPorId(idRol);
  }

  /**
   * Quita un permiso de un rol.
   *
   * REGLA DE NEGOCIO ROL_SIN_PERMISOS: un rol no puede quedar con
   * cero permisos, porque entonces no sirve para nada y quien lo
   * tenga no podra hacer ni una accion. Si quitar este permiso dejaria
   * el rol vacio, se responde 409 y no se toca la base.
   *
   * @param {number} idRol
   * @param {number} idPermiso
   * @returns {Promise<Permiso[]>} Los permisos que QUEDARON en el rol.
   * @throws {AppError} 404 rol/permiso inexistente o no asignado,
   *                    409 si seria el ultimo.
   */
  async quitarPermiso(idRol, idPermiso) {
    const permisosRestantes = await db.conTransaccion(async (conexion) => {
      const [roles] = await conexion.execute('SELECT id_rol FROM roles WHERE id_rol = ?', [idRol]);

      if (roles.length === 0) {
        throw AppError.noEncontrado(MENSAJES.NEGOCIO.ROL_NO_EXISTE(idRol));
      }

      const [asignados] = await conexion.execute(
        'SELECT id_rol FROM rol_permiso WHERE id_rol = ? AND id_permiso = ?',
        [idRol, idPermiso]
      );

      if (asignados.length === 0) {
        throw AppError.noEncontrado(MENSAJES.NEGOCIO.PERMISO_NO_ASIGNADO);
      }

      // Cuenta TODO lo que hay en la puente para este rol antes de
      // tocar nada. Si queda en 1, este es el ultimo y no se borra.
      const [conteo] = await conexion.execute(
        'SELECT COUNT(*) AS total FROM rol_permiso WHERE id_rol = ?',
        [idRol]
      );

      const total = Number(conteo[0]?.total ?? 0);

      if (total <= SEGURIDAD.MINIMO_PERMISOS_ROL) {
        throw AppError.conflicto(MENSAJES.NEGOCIO.ROL_SIN_PERMISOS);
      }

      await conexion.execute(
        'DELETE FROM rol_permiso WHERE id_rol = ? AND id_permiso = ?',
        [idRol, idPermiso]
      );

      // Se relee el listado DENTRO de la misma transaccion: asi el
      // resultado refleja el estado recien escrito y si algo mas
      // falla despues, todo se deshace junto.
      const [filas] = await conexion.execute(SQL_PERMISOS_DEL_ROL, [idRol]);

      return filas.map((fila) => Permiso.desdeFila(fila));
    });

    return permisosRestantes;
  }

  // =================================================================
  // METODOS PRIVADOS DE APOYO
  // ================================================================

  /**
   * Valida los campos de un rol y devuelve la instancia.
   *
   * @param {object} entrada
   * @returns {Rol}
   * @throws {AppError} 400 con el detalle campo a campo.
   */
  #validar(entrada) {
    const errores = new ColectorErrores();

    errores.exigirTexto('nombreRol', entrada.nombreRol, { maximo: LIMITES.NOMBRE_ROL });

    errores.exigirTexto('descripcion', entrada.descripcion, {
      maximo: LIMITES.DESCRIPCION,
      requerido: false
    });

    if (entrada.estado !== undefined && entrada.estado !== null && entrada.estado !== '') {
      errores.exigirValorDeLista('estado', entrada.estado, Object.values(ESTADO));
    }

    errores.lanzarSiHayErrores();

    return Rol.desdeJSON({
      nombreRol: String(entrada.nombreRol).trim(),
      descripcion:
        entrada.descripcion === undefined || entrada.descripcion === null
          ? null
          : String(entrada.descripcion).trim(),
      estado: entrada.estado || ESTADO.ACTIVO
    });
  }

  /**
   * Comprueba que el nombre del rol no este tomado.
   *
   * La columna `nombre_rol` tiene restriccion UNIQUE, asi que este
   * chequeo previo es COMODIDAD, no seguridad: devuelve un mensaje
   * entendible en vez de un ER_DUP_ENTRY generico. La proteccion real
   * la da la base (y, en una carrera entre dos peticiones, el
   * traductor de errores del middleware).
   *
   * @param {string} nombre
   * @param {number|null} idExcluido
   * @throws {AppError} 409 si ya existe.
   */
  async #asegurarNombreUnico(nombre, idExcluido) {
    const fila = await db.obtenerUno(
      'SELECT id_rol FROM roles WHERE nombre_rol = ? AND id_rol <> ?',
      [nombre, idExcluido ?? -1]
    );

    if (fila !== null) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.ROL_DUPLICADO(nombre));
    }
  }
}

module.exports = new RolService();
