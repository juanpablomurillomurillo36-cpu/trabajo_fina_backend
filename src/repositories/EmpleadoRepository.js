/**
 * src/repositories/EmpleadoRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de `empleados`. SQL SOLO aqui con `?` posicionales.
 * Singleton.
 */

const db = require('../config/database');
const Empleado = require('../models/Empleado');
const { Filtros } = require('../utils/consulta');
const { ESTADO } = require('../utils/constants');

// JOIN con la categoria para devolver tambien su nombre (igual que
// usuarios devuelven nombreRol). Alias en snake_case para desdeFila().
const SELECT_CON_CATEGORIA = `
  SELECT e.*, c.nombre AS nombre_categoria
    FROM empleados e
    JOIN categoria_empleado c ON c.id_categoria_empleado = e.id_categoria_empleado`;

class EmpleadoRepository {
  async listar({ estado, busqueda, idCategoria, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('e.estado = ?', estado);
    if (idCategoria) filtros.agregar('e.id_categoria_empleado = ?', idCategoria);
    if (busqueda) {
      filtros.agregarBusquedaMulti(
        ['e.nombre', 'e.apellido', 'e.documento', 'e.email'],
        busqueda
      );
    }

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM empleados e ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_CATEGORIA}
        ${where}
        ORDER BY e.apellido ASC, e.nombre ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Empleado.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `${SELECT_CON_CATEGORIA} WHERE e.id_empleado = ?`,
      [id]
    );
    return Empleado.desdeFila(fila);
  }

  /** Documento unico a nivel de tabla (indice `uq_empleados_documento`). */
  async existeDocumento(documento, idExcluido = null) {
    const sql = idExcluido
      ? 'SELECT 1 AS existe FROM empleados WHERE documento = ? AND id_empleado <> ?'
      : 'SELECT 1 AS existe FROM empleados WHERE documento = ?';
    const params = idExcluido ? [documento, idExcluido] : [documento];

    const fila = await db.obtenerUno(sql, params);
    return Boolean(fila);
  }

  async contarAgenda(id) {
    const fila = await db.obtenerUno(
      'SELECT COUNT(*) AS total FROM agenda_empleados WHERE id_empleado = ?',
      [id]
    );
    return Number(fila.total);
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO empleados
        (id_categoria_empleado, nombre, apellido, documento, telefono, email, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fila.id_categoria_empleado,
        fila.nombre,
        fila.apellido,
        fila.documento,
        fila.telefono,
        fila.email,
        fila.estado
      ]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      `UPDATE empleados
          SET id_categoria_empleado = ?, nombre = ?, apellido = ?, documento = ?,
              telefono = ?, email = ?, estado = ?
        WHERE id_empleado = ?`,
      [
        fila.id_categoria_empleado,
        fila.nombre,
        fila.apellido,
        fila.documento,
        fila.telefono,
        fila.email,
        fila.estado,
        id
      ]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE empleados SET estado = ? WHERE id_empleado = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar('DELETE FROM empleados WHERE id_empleado = ?', [id]);
    return resultado.affectedRows > 0;
  }

  async listarTodos(estado = ESTADO.ACTIVO) {
    const filas = await db.ejecutar(
      `${SELECT_CON_CATEGORIA} ${estado ? 'WHERE e.estado = ?' : ''}
        ORDER BY e.apellido ASC`,
      estado ? [estado] : []
    );
    return filas.map(Empleado.desdeFila);
  }
}

// Singleton.
module.exports = new EmpleadoRepository();
