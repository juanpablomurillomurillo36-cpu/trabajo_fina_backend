/**
 * src/repositories/DetalleReservaRepository.js
 * ---------------------------------------------------------------------
 * SQL de `detalle_reserva`. Como es HIJA de Reserva (composicion P4),
 * sus escrituras viajan DENTRO de la transaccion de la reserva: los
 * metodos de escritura reciben `conexion` (conexion cruda de mysql2).
 *
 * OJO: `subtotal` es columna GENERADA -> el INSERT solo pone
 * id_reserva, id_servicio, cantidad y precio_unitario.
 * Singleton.
 */

const db = require('../config/database');
const DetalleReserva = require('../models/DetalleReserva');

class DetalleReservaRepository {
  /**
   * Lineas de una reserva (lectura por el pool, con nombre del servicio).
   *
   * @param {number} idReserva
   * @returns {Promise<DetalleReserva[]>}
   */
  async listarPorReserva(idReserva) {
    const filas = await db.ejecutar(
      `SELECT d.*, s.nombre AS nombre_servicio
         FROM detalle_reserva d
         JOIN servicios s ON s.id_servicio = d.id_servicio
        WHERE d.id_reserva = ?
        ORDER BY d.id_detalle_reserva ASC`,
      [idReserva]
    );
    return filas.map(DetalleReserva.desdeFila);
  }

  /**
   * Inserta varias lineas en la MISMA transaccion de la reserva.
   *
   * @param {object} conexion  Conexion cruda de mysql2 (conexion.execute).
   * @param {number} idReserva
   * @param {DetalleReserva[]} detalles
   * @returns {Promise<number>} cuantas filas se insertaron.
   */
  async insertarVarios(conexion, idReserva, detalles) {
    let insertadas = 0;

    for (const detalle of detalles) {
      const fila = detalle.aFilaInsercion(idReserva);
      await conexion.execute(
        `INSERT INTO detalle_reserva (id_reserva, id_servicio, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?)`,
        [fila.id_reserva, fila.id_servicio, fila.cantidad, fila.precio_unitario]
      );
      insertadas += 1;
    }

    return insertadas;
  }

  /**
   * Borra TODAS las lineas de una reserva dentro de su transaccion
   * (la composicion se reemplaza entera al editar).
   *
   * @param {object} conexion
   * @param {number} idReserva
   */
  async eliminarPorReserva(conexion, idReserva) {
    await conexion.execute('DELETE FROM detalle_reserva WHERE id_reserva = ?', [idReserva]);
  }
}

// Singleton.
module.exports = new DetalleReservaRepository();
