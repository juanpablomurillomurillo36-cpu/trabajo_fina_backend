/**
 * src/repositories/CategoriaEmpleadoRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de `categoria_empleado`. Singleton.
 */

const db = require('../config/database');
const CategoriaEmpleado = require('../models/CategoriaEmpleado');
const { Filtros } = require('../utils/consulta');
const { ESTADO } = require('../utils/constants');

class CategoriaEmpleadoRepository {
  async listar({ estado, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('c.estado = ?', estado);
    if (busqueda) filtros.agregarBusquedaMulti(['c.nombre', 'c.descripcion'], busqueda);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM categoria_empleado c ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `SELECT c.* FROM categoria_empleado c
        ${where}
        ORDER BY c.nombre ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(CategoriaEmpleado.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      'SELECT * FROM categoria_empleado WHERE id_categoria_empleado = ?',
      [id]
    );
    return CategoriaEmpleado.desdeFila(fila);
  }

  /**
   * Nombre duplicado: el ENUM tiene indice unico `uq_categoria_empleado_nombre`,
   * asi que se compara contra TODOS los registros (aunque esten inactivos).
   */
  async existeNombre(nombre, idExcluido = null) {
    const sql = idExcluido
      ? `SELECT 1 AS existe FROM categoria_empleado
          WHERE nombre = ? AND id_categoria_empleado <> ?`
      : 'SELECT 1 AS existe FROM categoria_empleado WHERE nombre = ?';
    const params = idExcluido ? [nombre, idExcluido] : [nombre];

    const fila = await db.obtenerUno(sql, params);
    return Boolean(fila);
  }

  async contarEmpleados(id) {
    const fila = await db.obtenerUno(
      'SELECT COUNT(*) AS total FROM empleados WHERE id_categoria_empleado = ?',
      [id]
    );
    return Number(fila.total);
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO categoria_empleado (nombre, descripcion, estado)
       VALUES (?, ?, ?)`,
      [fila.nombre, fila.descripcion, fila.estado]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      'UPDATE categoria_empleado SET nombre = ?, descripcion = ?, estado = ? WHERE id_categoria_empleado = ?',
      [fila.nombre, fila.descripcion, fila.estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE categoria_empleado SET estado = ? WHERE id_categoria_empleado = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar(
      'DELETE FROM categoria_empleado WHERE id_categoria_empleado = ?',
      [id]
    );
    return resultado.affectedRows > 0;
  }

  async listarTodos(estado = ESTADO.ACTIVO) {
    const filas = await db.ejecutar(
      `SELECT * FROM categoria_empleado ${estado ? 'WHERE estado = ?' : ''} ORDER BY nombre ASC`,
      estado ? [estado] : []
    );
    return filas.map(CategoriaEmpleado.desdeFila);
  }
}

// Singleton.
module.exports = new CategoriaEmpleadoRepository();
