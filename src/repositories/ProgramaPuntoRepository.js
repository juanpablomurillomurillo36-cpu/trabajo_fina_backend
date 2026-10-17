/**
 * src/repositories/ProgramaPuntoRepository.js
 * ---------------------------------------------------------------------
 * Escrituras de `programa_puntos` sobre el patron de SQLAlchemy
 * (INSERT/UPDATE + SELECT ... FOR UPDATE en la misma transaccion).
 *
 * `id_cliente` NO es unique en el esquema: "buscar o insertar" se hace
 * dentro de una transaccion con bloqueo de fila para no duplicar.
 * SQL SOLO aqui (capa de acceso a datos).
 */

const db = require('../config/database');
const ProgramaPunto = require('../models/ProgramaPunto');
const AppError = require('../utils/AppError');

class ProgramaPuntoRepository {
  /**
   * Lee el programa del cliente. Si aun no existe, devuelve un
   * programa vacio (saldo 0) para que el service no tenga que
   * distinguir "sin fila" de "sin puntos".
   *
   * @param {number} idCliente
   * @returns {Promise<ProgramaPunto>}
   */
  async obtenerPorCliente(idCliente) {
    const filas = await db.ejecutar(
      `SELECT * FROM programa_puntos
        WHERE id_cliente = ?
        ORDER BY id_programa_puntos ASC
        LIMIT 1`,
      [idCliente]
    );
    return ProgramaPunto.desdeFila(filas[0]) ?? new ProgramaPunto(null, idCliente, 0, 0);
  }

  /**
   * Suma puntos ganados (pagar una venta) en UNA transaccion:
   * bloquea la fila, crea el registro si falta y luego suma.
   *
   * @param {number} idCliente
   * @param {number} puntos
   * @returns {Promise<ProgramaPunto>} estado final.
   */
  async acumular(idCliente, puntos) {
    await db.conTransaccion(async (conexion) => {
      const [filas] = await conexion.execute(
        `SELECT id_programa_puntos, puntos_acumulados, puntos_canjeados
           FROM programa_puntos
          WHERE id_cliente = ?
          ORDER BY id_programa_puntos ASC
          LIMIT 1
          FOR UPDATE`,
        [idCliente]
      );

      if (filas.length === 0) {
        await conexion.execute(
          'INSERT INTO programa_puntos (id_cliente, puntos_acumulados) VALUES (?, ?)',
          [idCliente, puntos]
        );
        return;
      }

      await conexion.execute(
        `UPDATE programa_puntos
            SET puntos_acumulados = puntos_acumulados + ?
          WHERE id_programa_puntos = ?`,
        [puntos, filas[0].id_programa_puntos]
      );
    });

    return this.obtenerPorCliente(idCliente);
  }

  /**
   * Descuenta puntos canjeados con doble guarda en el propio UPDATE:
   *   1. el saldo nunca baja de 0;
   *   2. el total canjado jamas supera el 50 % del acumulado (RN-11).
   * Si otra peticion cambio los puntos entre lectura y escritura,
   * affectedRows = 0 y se aborta con error.
   *
   * @param {number} idCliente
   * @param {number} cantidad
   * @returns {Promise<ProgramaPunto>} estado final.
   */
  async canjear(idCliente, cantidad) {
    const filas = await db.ejecutar(
      `SELECT id_programa_puntos FROM programa_puntos
        WHERE id_cliente = ?
        ORDER BY id_programa_puntos ASC
        LIMIT 1`,
      [idCliente]
    );

    if (filas.length === 0) {
      throw AppError.conflicto('El cliente aun no tiene programa de puntos');
    }

    const [resultado] = await db.ejecutar(
      `UPDATE programa_puntos
          SET puntos_canjeados = puntos_canjeados + ?
        WHERE id_programa_puntos = ?
          AND puntos_acumulados - puntos_canjeados >= ?
          AND FLOOR(puntos_acumulados * 50 / 100) >= puntos_canjeados + ?`,
      [cantidad, filas[0].id_programa_puntos, cantidad, cantidad]
    );

    if (resultado.affectedRows === 0) {
      throw AppError.conflicto('No fue posible canjear los puntos');
    }

    return this.obtenerPorCliente(idCliente);
  }
}

// Singleton.
module.exports = new ProgramaPuntoRepository();
