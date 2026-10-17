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
 *
 * DIVISION DE RESPONSABILIDADES CON EL SERVICE
 * ---------------------------------------------------------------------
 *   Repository -> SOLO ejecuta SQL (INSERT/DELETE/SELECT).
 *   Service    -> decide si la operacion esta permitida (404 si el
 *                 permiso no existe, 409 si el rol se quedaria sin
 *                 permisos). Aqui NUNCA se lanza un AppError.
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

  /**
   * Comprueba si el permiso existe en el catalogo `permisos`.
   *
   * Se consulta antes de INSERTar en la puente: si el id no existe,
   * MySQL rechazaria la fila con un error crudo de FK
   * (ER_NO_REFERENCED_ROW) que aqui convertiriamos en un 400 generico.
   * Con esta consulta el service puede dar un 404 especifico.
   *
   * @param {number} idPermiso
   * @returns {Promise<boolean>}
   */
  async existePermiso(idPermiso) {
    const fila = await db.obtenerUno(
      `SELECT 1 AS existe FROM permisos WHERE id_permiso = ?`,
      [idPermiso]
    );

    return fila !== null;
  }

  /**
   * Comprueba si el rol YA TIENE asignado ese permiso.
   *
   * @param {number} idRol
   * @param {number} idPermiso
   * @returns {Promise<boolean>}
   */
  async existePar(idRol, idPermiso) {
    const fila = await db.obtenerUno(
      `SELECT 1 AS existe FROM rol_permiso WHERE id_rol = ? AND id_permiso = ?`,
      [idRol, idPermiso]
    );

    return fila !== null;
  }

  /**
   * Asigna un permiso a un rol.
   *
   * ON DUPLICATE KEY UPDATE convierte la insercion en una operacion
   * IDEMPOTENTE: si el par ya existia, no falla y no duplica nada.
   * (A proposito no se usa INSERT IGNORE: ocultaria otros errores de
   * insercion, como una FK rota.)
   *
   * @param {number} idRol
   * @param {number} idPermiso
   * @returns {Promise<boolean>} true si al menos una fila fue afectada.
   */
  async asignar(idRol, idPermiso) {
    const resultado = await db.ejecutar(
      `INSERT INTO rol_permiso (id_rol, id_permiso) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE id_rol = id_rol`,
      [idRol, idPermiso]
    );

    // affectedRows: 1 = fila nueva, 2 = fila existente "actualizada"
    // con el mismo valor. En ambos casos el permiso quedo asignado.
    return resultado.affectedRows > 0;
  }

  /**
   * Quita un permiso del rol (solo SQL; la decision de si se PUEDE
   * quitar es del service).
   *
   * @param {number} idRol
   * @param {number} idPermiso
   * @returns {Promise<boolean>} true si existia y se elimino.
   */
  async eliminarPar(idRol, idPermiso) {
    const resultado = await db.ejecutar(
      `DELETE FROM rol_permiso WHERE id_rol = ? AND id_permiso = ?`,
      [idRol, idPermiso]
    );

    return resultado.affectedRows > 0;
  }

  /**
   * Cuantos permisos tiene el rol actualmente.
   *
   * Se usa justo despues de asignar/quitar para devolver el estado
   * real sin depender de lo que creemos que paso.
   *
   * @param {number} idRol
   * @returns {Promise<number>}
   */
  async contarPermisos(idRol) {
    const fila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM rol_permiso WHERE id_rol = ?`,
      [idRol]
    );

    return Number(fila?.total ?? 0);
  }
}

// SINGLETON
module.exports = new RolPermisoRepository();
