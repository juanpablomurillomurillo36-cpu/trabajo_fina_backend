/**
 * src/repositories/AutorizacionRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de las PREGUNTAS DE AUTORIZACION:
 *   "¿tiene el usuario ese permiso?" y "¿su rol esta activo con ese nombre?"
 *
 * POR QUE EXISTE (y no se consulta desde el middleware)?
 * Porque la regla de arquitectura dice que el SQL vive SOLO en
 * repositories. El middleware decide QUE preguntar; este archivo sabe
 * COMO preguntarle a MySQL.
 *
 * COMO RESPONDE LA BASE A "¿tiene permiso?"
 * No con una lista, sino con una UNION de tres JOINs:
 *
 *   usuarios (id, id_rol, estado='activo')
 *      |
 *      +--> roles (id_rol, nombre_rol, estado='activo')
 *      |
 *      +--> rol_permiso (id_rol, id_permiso)
 *              |
 *              +--> permisos (id_permiso, nombre_permiso, estado='activo')
 *
 * Si el resultado trae al menos UNA fila, el usuario tiene el permiso.
 * Si NO trae filas, puede ser por cualquier eslabon caido: usuario
 * inactivo, rol inactivo, permiso desactivado o simplemente no
 * asignado. Para el cliente da igual: se responde 403 generico.
 *
 * POR QUE TRES ESTADOS EN LA MISMA CONSULTA?
 * Porque el estado de seguridad es COMBINADO: un usuario activo con
 * un rol desactivado NO debe pasar (su rol fue revocado), y un rol
 * activo con un permiso desactivado tampoco (el permiso fue revocado).
 * Verificar los tres en una sola consulta evita cascadas de ifs y
 * solo cuesta UNA ida a la base por peticion autorizada.
 */

const db = require('../config/database');

class AutorizacionRepository {
  /**
   * ¿El usuario tiene ese permiso y todo su cadena esta activa?
   *
   * @param {number} idUsuario
   * @param {string} nombrePermiso  Ej. 'ventas.registrar'.
   * @returns {Promise<boolean>}
   */
  async tienePermiso(idUsuario, nombrePermiso) {
    const fila = await db.obtenerUno(
      `SELECT 1 AS existe
         FROM usuarios u
         JOIN roles r        ON r.id_rol = u.id_rol
         JOIN rol_permiso rp ON rp.id_rol = u.id_rol
         JOIN permisos p     ON p.id_permiso = rp.id_permiso
        WHERE u.id_usuario = ?
          AND u.estado = 'activo'
          AND r.estado = 'activo'
          AND p.nombre_permiso = ?
          AND p.estado = 'activo'
        LIMIT 1`,
      [idUsuario, nombrePermiso]
    );

    return fila !== null;
  }

  /**
   * ¿El rol con ese nombre existe y esta activo?
   *
   * Se consulta por id_rol (barato, PK) pero se exige el nombre: si
   * dos roles tuvieran somehow el mismo id con otro nombre (cambio a
   * mano en la BD), el check no dejaria pasar por inercia.
   *
   * @param {number} idRol
   * @param {string} nombreRol  Ej. 'admin'.
   * @returns {Promise<boolean>}
   */
  async rolActivoTieneNombre(idRol, nombreRol) {
    const fila = await db.obtenerUno(
      `SELECT 1 AS existe
         FROM roles
        WHERE id_rol = ?
          AND nombre_rol = ?
          AND estado = 'activo'
        LIMIT 1`,
      [idRol, nombreRol]
    );

    return fila !== null;
  }
}

// SINGLETON
module.exports = new AutorizacionRepository();
