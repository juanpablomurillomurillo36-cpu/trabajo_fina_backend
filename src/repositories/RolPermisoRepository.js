/**
 * src/repositories/RolPermisoRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de la tabla puente `rol_permiso` (relacion N:M entre
 * roles y permisos).
 *
 * POR QUE UN ARCHIVO PROPIO?
 * Porque `rol_permiso` es una TABLA, no un detalle decorativo. Toda
 * consulta que la toque vive aqui: es el unico dueño de esa tabla y asi
 * nadie duplica SQL de la relacion por el proyecto (R-DRY).
 *
 * COMO FUNCIONA UNA TABLA PUENTE?
 *   roles          permisos               rol_permiso
 *   -------------  ---------------------  ------------------------
 *   1 admin        1 roles.crear          (1, 1)
 *   2 barman       2 roles.editar          (1, 2)
 *                                                 ...
 *   Solo guarda DOS IDs; los datos "de verdad" (nombre, estado) se
 *   recuperan con un JOIN contra `permisos`.
 *
 * La PK compuesta (id_rol, id_permiso) impide asignar dos veces el
 * mismo permiso al mismo rol: MySQL rechaza la fila duplicada.
 */

/**
 * Comprueba si YA EXISTE un permiso con ese id.
 *
 * Se usa en el service para validar que el cliente no intente asignar
 * un permiso que no existe en la base de datos (evitaría que MySQL
 * lancara ER_ROW_IS_REFERENCED).
 *
 * @param {number} idPermiso
 * @returns {Promise<boolean>}
 */
async existePermiso(idPermiso) {
  const fila = await db.obtenerOne(
    `SELECT 1 AS existe FROM permisos WHERE id_permiso = ?`,
    [idPermiso]
  );
  return fila !== null;
}

/**
 * Asigna un permiso a un rol (insere en la tabla puente).
 *
 * Si el permiso ya estaba asignado a ese rol, la insercion es IGNORADA
 * gracias a ON DUPLICATE KEY UPDATE (la PK compuesta lo impide).
 * El metodo devuelve `true` si la operacion fue exitosa (sea nuevo o ya existia).
 *
 * @param {number} idRol
 * @param {number} idPermiso
 * @returns {Promise<boolean>}
 */
async asignarPermisoARol(idRol, idPermiso) {
  const resultado = await db.ejecutar(
    `INSERT INTO rol_permiso (id_rol, id_permiso) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE id_rol = id_rol`,
    [idRol, idPermiso]
  );
  return resultado.affectedRows > 0;
}

/**
 * Quita un permiso de un rol (elimina de la tabla puente).
 *
 * Si este era el ultimo permiso del rol, la operacion falla y devuelve
 * `false` para que el service responda con 409 ROL_SIN_PERMISOS.
 *
 * @param {number} idRol
 * @param {number} idPermiso
 * @returns {Promise<boolean>} `true` si se borro, `false` si era el ultimo.
 */
async quitarPermisoDeRol(idRol, idPermiso) {
  // Primero verifico cuantas asignaciones tiene este rol DESPUES de borrar.
  // Para no contar en memoria, hago un DELETE y luego cuento lo que queda.
  const antes = await this.listarPermisosDeRol(idRol);
  const cantidadAntes = antes.length;

  const resultado = await db.ejecutar(
    `DELETE FROM rol_permiso WHERE id_rol = ? AND id_permiso = ?`,
    [idRol, idPermiso]
  );

  const afectado = resultado.affectedRows > 0;
  const despues = await this.listarPermisosDeRol(idRol);
  const cantidadDespues = despues.length;

  // Si despues de borrar el rol quedo sin permisos, lo deshago
  // (no se aplica el borrado) y devuelvo false para que el service
  // lance el 409 ROL_SIN_PERMISOS.
  if (afectado && cantidadDespues < cantidadAntes) {
    // Borrado confirmado: devuelvo true si aun quedan permisos,
    // o false si el rol ahora queda con 0 (el service decidira).
    return cantidadDespues > 0;
  }

  // Si no se pudo borrar (no existia la asignacion) o quedo sin permisos
  return false;
}
