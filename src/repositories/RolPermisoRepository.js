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

const db = require('../config/database');
const { Permiso } = require('../models');

class RolPermisoRepository {
  /**
   * Permisos asignados a un rol, ya como objetos Permiso.
   *
   * Se pide `ORDER BY nombre_permiso` para que el detalle salga
   * siempre en el mismo orden: sin ORDER BY, MySQL no garantiza el
   * orden de las filas y dos respuestas iguales podrian venir
   * desordenadas (lo que confunde a quien compara respuestas en
   * las pruebas de Postman).
   *
   * @param {number} idRol
   * @returns {Promise<Permiso[]>}
   */
  async listarPermisosDeRol(idRol) {
    const filas = await db.ejecutar(
      `SELECT p.id_permiso, p.nombre_permiso, p.descripcion, p.estado
         FROM rol_permiso rp
         JOIN permisos p ON p.id_permiso = rp.id_permiso
        WHERE rp.id_rol = ?
        ORDER BY p.nombre_permiso ASC`,
      [idRol]
    );

    return filas.map((fila) => Permiso.desdeFila(fila));
  }
}

// SINGLETON
module.exports = new RolPermisoRepository();
