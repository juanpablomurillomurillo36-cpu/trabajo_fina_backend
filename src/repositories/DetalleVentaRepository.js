/**
 * src/repositories/DetalleVentaRepository.js
 * ---------------------------------------------------------------------
 * SQL de `detalle_ventas`. Como es HIJA de Venta (composicion P4),
 * sus escrituras viajan DENTRO de la transaccion de la venta: los
 * metodos de escritura reciben `conexion` (conexion cruda de mysql2).
 *
 * OJO: `subtotal` es columna GENERADA -> el INSERT solo pone
 * id_venta, id_producto, cantidad y precio_unitario.
 * Singleton.
 */

const db = require('../config/database');
const DetalleVenta = require('../models/DetalleVenta');

class DetalleVentaRepository {
  /**
   * Lineas de una venta (lectura por el pool, con nombre del producto).
   *
   * @param {number} idVenta
   * @returns {Promise<DetalleVenta[]>}
   */
  async listarPorVenta(idVenta) {
    const filas = await db.ejecutar(
      `SELECT d.*, p.nombre AS nombre_producto
         FROM detalle_ventas d
         JOIN productos p ON p.id_producto = d.id_producto
        WHERE d.id_venta = ?
        ORDER BY d.id_detalle_venta ASC`,
      [idVenta]
    );
    return filas.map(DetalleVenta.desdeFila);
  }

  /**
   * Inserta varias lineas en la MISMA transaccion de la venta.
   *
   * @param {object} conexion  Conexion cruda de mysql2.
   * @param {number} idVenta
   * @param {DetalleVenta[]} detalles
   * @returns {Promise<number>} cuantas filas se insertaron.
   */
  async insertarVarios(conexion, idVenta, detalles) {
    let insertadas = 0;

    for (const detalle of detalles) {
      const fila = detalle.aFilaInsercion(idVenta);
      await conexion.execute(
        `INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?)`,
        [fila.id_venta, fila.id_producto, fila.cantidad, fila.precio_unitario]
      );
      insertadas += 1;
    }

    return insertadas;
  }

  /**
   * Borra TODAS las lineas de una venta dentro de su transaccion
   * (la composicion se reemplaza entera al editar).
   *
   * @param {object} conexion
   * @param {number} idVenta
   */
  async eliminarPorVenta(conexion, idVenta) {
    await conexion.execute('DELETE FROM detalle_ventas WHERE id_venta = ?', [idVenta]);
  }
}

// Singleton.
module.exports = new DetalleVentaRepository();
