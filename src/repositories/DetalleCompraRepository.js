/**
 * src/repositories/DetalleCompraRepository.js
 * ---------------------------------------------------------------------
 * SQL de `detalle_compras`. Como es HIJA de Compra (composicion P4),
 * sus escrituras siempre viajan DENTRO de la transaccion de la compra:
 * por eso los metodos de escritura reciben `conexion` (la conexion
 * cruda de mysql2 que abre db.conTransaccion) y jamas usan el pool.
 *
 * OJO: `subtotal` es columna GENERADA -> en el INSERT solo se ponen
 * id_compra, id_producto, cantidad y precio_unitario.
 * Singleton.
 */

const db = require('../config/database');
const DetalleCompra = require('../models/DetalleCompra');

class DetalleCompraRepository {
  /**
   * Lineas de una compra (lectura por el pool, con nombre del producto).
   *
   * @param {number} idCompra
   * @returns {Promise<DetalleCompra[]>}
   */
  async listarPorCompra(idCompra) {
    const filas = await db.ejecutar(
      `SELECT d.*, p.nombre AS nombre_producto
         FROM detalle_compras d
         JOIN productos p ON p.id_producto = d.id_producto
        WHERE d.id_compra = ?
        ORDER BY d.id_detalle_compra ASC`,
      [idCompra]
    );
    return filas.map(DetalleCompra.desdeFila);
  }

  /**
   * Inserta varias lineas en la MISMA transaccion de la compra.
   *
   * @param {object} conexion  Conexion cruda de mysql2 (conexion.execute).
   * @param {number} idCompra
   * @param {DetalleCompra[]} detalles
   * @returns {Promise<number>} cuantas filas se insertaron.
   */
  async insertarVarios(conexion, idCompra, detalles) {
    let insertadas = 0;

    for (const detalle of detalles) {
      const fila = detalle.aFilaInsercion(idCompra);
      await conexion.execute(
        `INSERT INTO detalle_compras (id_compra, id_producto, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?)`,
        [fila.id_compra, fila.id_producto, fila.cantidad, fila.precio_unitario]
      );
      insertadas += 1;
    }

    return insertadas;
  }

  /**
   * Borra TODAS las lineas de una compra dentro de su transaccion
   * (se usa al editar: composicion = el detalle se reemplaza entero).
   *
   * @param {object} conexion
   * @param {number} idCompra
   */
  async eliminarPorCompra(conexion, idCompra) {
    await conexion.execute('DELETE FROM detalle_compras WHERE id_compra = ?', [idCompra]);
  }
}

// Singleton.
module.exports = new DetalleCompraRepository();
