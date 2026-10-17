/**
 * src/repositories/UsuarioRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de la tabla `usuarios`.
 *
 * AQUI VIVE: SQL de usuarios y el mapeo fila -> Usuario.
 * NO VIVE:  hashing de contrasenas (utils/cifrado), validaciones de
 *           formato, unicidad de correo como REGLA (eso es 409 en el
 *           service) ni HTTP.
 *
 * SEGURIDAD ESPECIAL DE ESTE ARCHIVO
 * ---------------------------------------------------------------------
 *   - Los SELECT NUNCA piden `*`: solo las columnas necesarias, para
 *     que el hash de la contrasena no viaje de mas por el codigo.
 *     La unica excepcion es obtenerPorEmail/obtenerPorId, que SI
 *     necesitan el hash (para verificar la contrasena en el login y en
 *     el cambio de clave), pero esos objetos NUNCA se serializan con
 *     toJSON() hacia el cliente.
 *   - Todo es parametrizado con ? (la busqueda de correo es el ataque
 *     SQL tipico: `email = "x' OR '1'='1"`; con ? ese texto se busca
 *     LITERALMENTE y no cambia la consulta).
 */

const db = require('../config/database');
const { Usuario } = require('../models');
const { Filtros, aLimites } = require('../utils/consulta');

class UsuarioRepository {
  /**
   * Listado paginado con filtros opcionales.
   *
   * El JOIN con roles es LEFT: un usuario sin rol valido aun apareceria
   * en el listado (aunque la FK lo impide, el LEFT evita perder filas
   * si algun dia se relaja la restriccion).
   *
   * @param {object}   opciones
   * @param {string}   [opciones.estado]    'activo' | 'inactivo' | null
   * @param {string}   [opciones.busqueda]  Coincide con nombre, apellido o email.
   * @param {number}   [opciones.idRol]     Filtra por rol.
   * @param {number}   [opciones.pagina]
   * @param {number}   [opciones.limite]
   * @returns {Promise<{ usuarios: Usuario[], total: number }>}
   */
  async listar({ estado = null, busqueda = null, idRol = null, pagina = 1, limite = 20 } = {}) {
    const filtros = new Filtros();

    filtros
      .agregarSi(estado, 'u.estado = ?', estado)
      .agregarSi(idRol, 'u.id_rol = ?', idRol)
      // Busqueda en varias columnas con OR (paréntesis incluidos por
      // la utilidad) para que escribir "ana" o "ana@correo.mx" funcione.
      .agregarBusquedaMulti(['u.nombre', 'u.apellido', 'u.email'], busqueda);

    const where = filtros.obtenerWhere();
    const parametros = filtros.obtenerParametros();
    const { limite: porPagina, offset } = aLimites(pagina, limite);

    const [total, filas] = await Promise.all([
      this.#contar(where, parametros),
      db.ejecutar(
        `SELECT u.id_usuario, u.id_rol, u.nombre, u.apellido, u.email,
                u.telefono, u.estado, u.fecha_creacion, r.nombre_rol
           FROM usuarios u
           LEFT JOIN roles r ON r.id_rol = u.id_rol
           ${where}
          ORDER BY u.apellido ASC, u.nombre ASC
          LIMIT ? OFFSET ?`,
        [...parametros, porPagina, offset]
      )
    ]);

    return {
      usuarios: filas.map((fila) => Usuario.desdeFila(fila)),
      total
    };
  }

  /**
   * Usuario por id, con el nombre del rol resuelto.
   *
   * SI trae contrasena_hash: lo necesita el service para verificar
   * credenciales y para editar sin borrarla. El toJSON() del modelo
   * es quien evita que ese hash llegue al cliente.
   *
   * @param {number} id
   * @returns {Promise<Usuario|null>}
   */
  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `SELECT u.id_usuario, u.id_rol, u.nombre, u.apellido, u.email,
              u.contrasena_hash, u.telefono, u.estado, u.fecha_creacion,
              r.nombre_rol
         FROM usuarios u
         LEFT JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = ?`,
      [id]
    );

    return Usuario.desdeFila(fila);
  }

  /**
   * Usuario por correo (login y registro).
   *
   * Es la consulta que sostiene la autenticacion: busca EXACTAMENTE
   * ese correo con parametrizacion, nunca concatenando el texto del
   * cliente.
   *
   * @param {string} email  Ya normalizado (minusculas) por el service.
   * @returns {Promise<Usuario|null>}
   */
  async obtenerPorEmail(email) {
    const fila = await db.obtenerUno(
      `SELECT id_usuario, id_rol, nombre, apellido, email, contrasena_hash,
              telefono, estado, fecha_creacion
         FROM usuarios
        WHERE email = ?
        LIMIT 1`,
      [email]
    );

    return Usuario.desdeFila(fila);
  }

  /**
   * Comprueba si YA EXISTE una cuenta con ese correo (409 en el service).
   *
   * @param {string}      email
   * @param {number|null} [idExcluido]  Se ignora al editar.
   * @returns {Promise<boolean>}
   */
  async existeEmail(email, idExcluido = null) {
    const filtros = new Filtros();
    filtros
      .agregar('email = ?', email)
      .agregarSi(idExcluido, 'id_usuario <> ?', idExcluido);

    const fila = await db.obtenerUno(
      `SELECT 1 AS existe
         FROM usuarios
         ${filtros.obtenerWhere()}
        LIMIT 1`,
      filtros.obtenerParametros()
    );

    return fila !== null;
  }

  /**
   * Comprueba que el rol indicado exista realmente (FK id_rol).
   *
   * Se consulta antes de INSERTar para responder un 400 claro en vez
   * de recibir el error crudo ER_NO_REFERENCED_ROW de MySQL.
   *
   * @param {number} idRol
   * @returns {Promise<boolean>}
   */
  async existeRol(idRol) {
    const fila = await db.obtenerUno(`SELECT 1 AS existe FROM roles WHERE id_rol = ?`, [idRol]);
    return fila !== null;
  }

  /**
   * Cuantas filas de OTRAS tablas dependen de este usuario.
   *
   * La tabla `usuarios` es referenciada por accesos, bitacora e
   * ingresos, todas con FK sin CASCADE (bitacora ademas declara
   * RESTRICT). Si se intentara borrar un usuario referenciado, MySQL
   * rechazaria la operacion con un error crudo. Con este conteo el
   * service responde 409 con un mensaje entendible ANTES de fallar.
   *
   * @param {number} idUsuario
   * @returns {Promise<{accesos: number, bitacora: number, ingresos: number, total: number}>}
   */
  async contarReferencias(idUsuario) {
    const [accesos, bitacora, ingresos] = await Promise.all([
      db.obtenerUno(`SELECT COUNT(*) AS total FROM accesos WHERE id_usuario = ?`, [idUsuario]),
      db.obtenerUno(`SELECT COUNT(*) AS total FROM bitacora WHERE id_usuario = ?`, [idUsuario]),
      db.obtenerUno(`SELECT COUNT(*) AS total FROM ingresos WHERE validado_por = ?`, [idUsuario])
    ]);

    const referencia = {
      accesos: Number(accesos?.total ?? 0),
      bitacora: Number(bitacora?.total ?? 0),
      ingresos: Number(ingresos?.total ?? 0)
    };

    return { ...referencia, total: referencia.accesos + referencia.bitacora + referencia.ingresos };
  }

  /**
   * Inserta un usuario y devuelve su id.
   *
   * Incluye contrasena_hash: la columna es NOT NULL y asi debe ser,
   * siempre que llegue YA hasheada desde el service.
   *
   * @param {Usuario} usuario
   * @returns {Promise<number>}
   */
  async crear(usuario) {
    const fila = usuario.aFilaBaseDatos();

    const resultado = await db.ejecutar(
      `INSERT INTO usuarios
         (id_rol, nombre, apellido, email, contrasena_hash, telefono, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fila.id_rol,
        fila.nombre,
        fila.apellido,
        fila.email,
        fila.contrasena_hash,
        fila.telefono,
        fila.estado
      ]
    );

    return resultado.insertId;
  }

  /**
   * Actualiza los datos editables (NO la contrasena: esa viaja por
   * cambiarContrasena() para que el cambio quede aislado).
   *
   * @param {number} id
   * @param {Usuario} usuario
   * @returns {Promise<boolean>}
   */
  async actualizar(id, usuario) {
    const fila = usuario.aFilaBaseDatos();

    const resultado = await db.ejecutar(
      `UPDATE usuarios
          SET id_rol   = ?,
              nombre   = ?,
              apellido = ?,
              email    = ?,
              telefono = ?,
              estado   = ?
        WHERE id_usuario = ?`,
      [fila.id_rol, fila.nombre, fila.apellido, fila.email, fila.telefono, fila.estado, id]
    );

    return resultado.affectedRows > 0;
  }

  /**
   * Cambia SOLO la contrasena (login, recuperacion, perfil).
   *
   * @param {number} id
   * @param {string} hash  bcrypt ya generado.
   * @returns {Promise<boolean>}
   */
  async cambiarContrasena(id, hash) {
    const resultado = await db.ejecutar(
      `UPDATE usuarios SET contrasena_hash = ? WHERE id_usuario = ?`,
      [hash, id]
    );

    return resultado.affectedRows > 0;
  }

  /**
   * Cambia SOLO el estado (baja/alta logica).
   *
   * @param {number} id
   * @param {string} estado
   * @returns {Promise<boolean>}
   */
  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      `UPDATE usuarios SET estado = ? WHERE id_usuario = ?`,
      [estado, id]
    );

    return resultado.affectedRows > 0;
  }

  /**
   * Elimina fisicamente el usuario.
   *
   * Solo se ejecuta despues de que el service confirmo con
   * contarReferencias() que nadie depende de esta cuenta.
   *
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async eliminar(id) {
    const resultado = await db.ejecutar(`DELETE FROM usuarios WHERE id_usuario = ?`, [id]);

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
      `SELECT COUNT(*) AS total FROM usuarios u ${where}`,
      parametros
    );

    return Number(fila?.total ?? 0);
  }
}

// SINGLETON
module.exports = new UsuarioRepository();
