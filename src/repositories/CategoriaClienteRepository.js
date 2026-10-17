/**
 * src/repositories/CategoriaClienteRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de `categoria_clientes`. Singleton.
 */

const db = require('../config/database');
const CategoriaCliente = require('../models/CategoriaCliente');
const { Filtros } = require('../utils/consulta');
const { ESTADO } = require('../utils/constants');

class CategoriaClienteRepository {
  async listar({ estado, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('c.estado = ?', estado);
    if (busqueda) filtros.agregarBusquedaMulti(['c.nombre', 'c.descripcion'], busqueda);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM categoria_clientes c ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `SELECT c.* FROM categoria_clientes c
        ${where}
        ORDER BY c.nombre ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(CategoriaCliente.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      'SELECT * FROM categoria_clientes WHERE id_categoria_cliente = ?',
      [id]
    );
    return CategoriaCliente.desdeFila(fila);
  }

  /** Nombre unico solo entre activos (regla en service, C-02). */
  async existeNombre(nombre, idExcluido = null) {
    const sql = idExcluido
      ? `SELECT 1 AS existe FROM categoria_clientes
          WHERE nombre = ? AND estado = 'activo' AND id_categoria_cliente <> ?`
      : `SELECT 1 AS existe FROM categoria_clientes WHERE nombre = ? AND estado = 'activo'`;
    const params = idExcluido ? [nombre, idExcluido] : [nombre];

    const fila = await db.obtenerUno(sql, params);
    return Boolean(fila);
  }

  async contarClientes(id) {
    const fila = await db.obtenerUno(
      'SELECT COUNT(*) AS total FROM clientes WHERE id_categoria_cliente = ?',
      [id]
    );
    return Number(fila.total);
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO categoria_clientes (nombre, descripcion, estado)
       VALUES (?, ?, ?)`,
      [fila.nombre, fila.descripcion, fila.estado]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      'UPDATE categoria_clientes SET nombre = ?, descripcion = ?, estado = ? WHERE id_categoria_cliente = ?',
      [fila.nombre, fila.descripcion, fila.estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE categoria_clientes SET estado = ? WHERE id_categoria_cliente = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar(
      'DELETE FROM categoria_clientes WHERE id_categoria_cliente = ?',
      [id]
    );
    return resultado.affectedRows > 0;
  }

  async listarTodos(estado = ESTADO.ACTIVO) {
    const filas = await db.ejecutar(
      `SELECT * FROM categoria_clientes ${estado ? 'WHERE estado = ?' : ''} ORDER BY nombre ASC`,
      estado ? [estado] : []
    );
    return filas.map(CategoriaCliente.desdeFila);
  }
}

// Singleton.
module.exports = new CategoriaClienteRepository();
