/**
 * src/repositories/ProductoRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de `productos`. SQL SOLO aqui, parametros posicionales.
 *
 * Singleton.
 */

const db = require('../config/database');
const Producto = require('../models/Producto');
const { Filtros } = require('../utils/consulta');
const { ESTADO } = require('../utils/constants');

class ProductoRepository {
  /**
   * Listado paginado (filtros: estado y busqueda de texto).
   */
  async listar({ estado, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('p.estado = ?', estado);
    if (busqueda) filtros.agregarBusquedaMulti(['p.nombre', 'p.descripcion'], busqueda);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA (objeto), no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM productos p ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `SELECT p.* FROM productos p
        ${where}
        ORDER BY p.nombre ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Producto.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno('SELECT * FROM productos WHERE id_producto = ?', [id]);
    return Producto.desdeFila(fila);
  }

  /**
   * Nombre duplicado: se compara SOLO entre activos (no hay indice
   * unico en MySQL; la regla vive en la capa de servicio, C-02).
   */
  async existeNombre(nombre, idExcluido = null) {
    const sql = idExcluido
      ? `SELECT 1 AS existe FROM productos
          WHERE nombre = ? AND estado = 'activo' AND id_producto <> ?`
      : `SELECT 1 AS existe FROM productos WHERE nombre = ? AND estado = 'activo'`;
    const params = idExcluido ? [nombre, idExcluido] : [nombre];

    const fila = await db.obtenerUno(sql, params);
    return Boolean(fila);
  }

  /**
   * Cuantas lineas de compras y ventas referencian este producto.
   * Se ejecutan las dos consultas en paralelo (Promise.all, R-ASYNC).
   *
   * @returns {Promise<{compras:number, ventas:number}>}
   */
  async contarUsos(id) {
    const [compras, ventas] = await Promise.all([
      db.obtenerUno('SELECT COUNT(*) AS total FROM detalle_compras WHERE id_producto = ?', [id]),
      db.obtenerUno('SELECT COUNT(*) AS total FROM detalle_ventas WHERE id_producto = ?', [id])
    ]);

    return { compras: Number(compras.total), ventas: Number(ventas.total) };
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO productos
        (nombre, descripcion, precio_venta, stock_actual, stock_minimo, stock_maximo, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fila.nombre,
        fila.descripcion,
        fila.precio_venta,
        fila.stock_actual,
        fila.stock_minimo,
        fila.stock_maximo,
        fila.estado
      ]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      `UPDATE productos
          SET nombre = ?, descripcion = ?, precio_venta = ?, stock_actual = ?,
              stock_minimo = ?, stock_maximo = ?, estado = ?
        WHERE id_producto = ?`,
      [
        fila.nombre,
        fila.descripcion,
        fila.precio_venta,
        fila.stock_actual,
        fila.stock_minimo,
        fila.stock_maximo,
        fila.estado,
        id
      ]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE productos SET estado = ? WHERE id_producto = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar('DELETE FROM productos WHERE id_producto = ?', [id]);
    return resultado.affectedRows > 0;
  }

  /**
   * Productos ACTIVOS con stock por debajo del minimo (RN-03).
   *
   * @returns {Promise<Producto[]>}
   */
  async listarBajoStock() {
    const filas = await db.ejecutar(
      `SELECT * FROM productos
        WHERE estado = 'activo' AND stock_minimo > 0 AND stock_actual < stock_minimo
        ORDER BY stock_actual ASC`
    );
    return filas.map(Producto.desdeFila);
  }

  async listarTodos(estado = ESTADO.ACTIVO) {
    const filas = await db.ejecutar(
      `SELECT * FROM productos ${estado ? 'WHERE estado = ?' : ''} ORDER BY nombre ASC`,
      estado ? [estado] : []
    );
    return filas.map(Producto.desdeFila);
  }
}

// Singleton.
module.exports = new ProductoRepository();
