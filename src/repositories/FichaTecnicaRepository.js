/**
 * src/repositories/FichaTecnicaRepository.js
 * ---------------------------------------------------------------------
 * SQL de `ficha_tecnica` (1:1) y su N:N `ficha_servicio`.
 *
 * Escrituras de la ficha y de sus servicios viajan juntas en UNA
 * transaccion (composicion 1:1 + N:N: o todo o nada). Singleton.
 */

const db = require('../config/database');
const FichaTecnica = require('../models/FichaTecnica');
const FichaServicio = require('../models/FichaServicio');

class FichaTecnicaRepository {
  /** ¿El evento ya tiene ficha? (uq_ficha_evento). */
  async existePorEvento(idEvento) {
    const fila = await db.obtenerUno(
      'SELECT 1 AS existe FROM ficha_tecnica WHERE id_evento = ?',
      [idEvento]
    );
    return Boolean(fila);
  }

  /** Ficha del evento + su N:N de servicios. */
  async obtenerPorEvento(idEvento) {
    const [fila, servicios] = await Promise.all([
      db.obtenerUno('SELECT * FROM ficha_tecnica WHERE id_evento = ?', [idEvento]),
      this.listarServiciosPorEvento(idEvento)
    ]);

    const ficha = FichaTecnica.desdeFila(fila);
    if (ficha === null) return null;

    ficha.servicios = servicios;
    return ficha;
  }

  /**
   * Servicios N:N de la ficha de un evento.
   *
   * @param {number} idEvento
   * @returns {Promise<FichaServicio[]>}
   */
  async listarServiciosPorEvento(idEvento) {
    const filas = await db.ejecutar(
      `SELECT fs.*, s.nombre AS nombre_servicio
         FROM ficha_servicio fs
         JOIN ficha_tecnica ft ON ft.id_ficha_tecnica = fs.id_ficha_tecnica
         JOIN servicios s ON s.id_servicio = fs.id_servicio
        WHERE ft.id_evento = ?
        ORDER BY fs.id_servicio ASC`,
      [idEvento]
    );
    return filas.map(FichaServicio.desdeFila);
  }

  /**
   * Alta de ficha + servicios N:N en UNA transaccion.
   *
   * @param {object} filaFicha snake_case.
   * @param {FichaServicio[]} servicios
   * @returns {Promise<number>} id de la ficha creada.
   */
  async crearConServicios(filaFicha, servicios) {
    return db.conTransaccion(async (conexion) => {
      const [resultado] = await conexion.execute(
        `INSERT INTO ficha_tecnica (id_evento, tematica, franja_horaria, cantidad_invitados, observaciones)
         VALUES (?, ?, ?, ?, ?)`,
        [
          filaFicha.id_evento,
          filaFicha.tematica,
          filaFicha.franja_horaria,
          filaFicha.cantidad_invitados,
          filaFicha.observaciones
        ]
      );

      const idFicha = resultado.insertId;
      await this.insertarServicios(conexion, idFicha, servicios);

      return idFicha;
    });
  }

  /**
   * Edicion de ficha + reemplazo TOTAL de su N:N en transaccion.
   *
   * @param {number} idFicha
   * @param {object} filaFicha
   * @param {FichaServicio[]} servicios
   */
  async actualizarConServicios(idFicha, filaFicha, servicios) {
    await db.conTransaccion(async (conexion) => {
      await conexion.execute(
        `UPDATE ficha_tecnica
            SET tematica = ?, franja_horaria = ?, cantidad_invitados = ?, observaciones = ?
          WHERE id_ficha_tecnica = ?`,
        [
          filaFicha.tematica,
          filaFicha.franja_horaria,
          filaFicha.cantidad_invitados,
          filaFicha.observaciones,
          idFicha
        ]
      );

      await conexion.execute('DELETE FROM ficha_servicio WHERE id_ficha_tecnica = ?', [idFicha]);
      await this.insertarServicios(conexion, idFicha, servicios);
    });
  }

  /**
   * Inserta el N:N dentro de la transaccion abierta por el caller.
   *
   * @param {object} conexion  Conexion cruda de mysql2.
   * @param {number} idFicha
   * @param {FichaServicio[]} servicios
   */
  async insertarServicios(conexion, idFicha, servicios) {
    for (const servicio of servicios) {
      const fila = servicio.aFila();
      await conexion.execute(
        `INSERT INTO ficha_servicio (id_ficha_tecnica, id_servicio, cantidad_requerida)
         VALUES (?, ?, ?)`,
        [idFicha, fila.id_servicio, fila.cantidad_requerida]
      );
    }
  }

  /** Baja fisica de la ficha (los servicios caen en cascada). */
  async eliminar(idFicha) {
    const resultado = await db.ejecutar(
      'DELETE FROM ficha_tecnica WHERE id_ficha_tecnica = ?',
      [idFicha]
    );
    return resultado.affectedRows > 0;
  }
}

// Singleton.
module.exports = new FichaTecnicaRepository();
