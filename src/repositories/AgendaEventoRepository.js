/**
 * src/repositories/AgendaEventoRepository.js
 * ---------------------------------------------------------------------
 * SQL de `agenda_eventos`. Singleton. SQL SOLO aqui.
 */

const db = require('../config/database');
const AgendaEvento = require('../models/AgendaEvento');
const { Filtros } = require('../utils/consulta');
const { ESTADO_AGENDA } = require('../utils/constants');

const SELECT_CON_EVENTO = `
  SELECT a.*, e.nombre AS nombre_evento
    FROM agenda_eventos a
    JOIN evento e ON e.id_evento = a.id_evento`;

class AgendaEventoRepository {
  /** @returns {Promise<{total:number, filas:AgendaEvento[]}>} */
  async listar({ estado, idEvento, fecha, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('a.estado = ?', estado);
    if (idEvento) filtros.agregar('a.id_evento = ?', idEvento);
    if (fecha) filtros.agregar('a.fecha = ?', fecha);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM agenda_eventos a ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_EVENTO}
        ${where}
        ORDER BY a.fecha DESC, a.hora ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(AgendaEvento.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(`${SELECT_CON_EVENTO} WHERE a.id_agenda_evento = ?`, [id]);
    return AgendaEvento.desdeFila(fila);
  }

  /**
   * RN-08: ¿ya hay OTRA actividad programada en esa fecha y hora?
   * Solo chocan las 'programada' (completadas o canceladas no bloquean).
   *
   * @param {string} fecha      'YYYY-MM-DD'
   * @param {string} hora       'HH:MM:SS'
   * @param {number|null} idExcluido  Actividad a ignorar (edicion).
   * @returns {Promise<boolean>}
   */
  async existeConflicto(fecha, hora, idExcluido = null) {
    const sql = idExcluido
      ? `SELECT 1 AS existe FROM agenda_eventos
          WHERE fecha = ? AND hora = ?
            AND estado = ? AND id_agenda_evento <> ?`
      : `SELECT 1 AS existe FROM agenda_eventos
          WHERE fecha = ? AND hora = ? AND estado = ?`;

    const parametros = idExcluido
      ? [fecha, hora, ESTADO_AGENDA.PROGRAMADA, idExcluido]
      : [fecha, hora, ESTADO_AGENDA.PROGRAMADA];

    const fila = await db.obtenerUno(sql, parametros);
    return Boolean(fila);
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO agenda_eventos (id_evento, fecha, hora, descripcion, estado)
       VALUES (?, ?, ?, ?, ?)`,
      [fila.id_evento, fila.fecha, fila.hora, fila.descripcion, fila.estado]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      `UPDATE agenda_eventos
          SET id_evento = ?, fecha = ?, hora = ?, descripcion = ?, estado = ?
        WHERE id_agenda_evento = ?`,
      [fila.id_evento, fila.fecha, fila.hora, fila.descripcion, fila.estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE agenda_eventos SET estado = ? WHERE id_agenda_evento = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar(
      'DELETE FROM agenda_eventos WHERE id_agenda_evento = ?',
      [id]
    );
    return resultado.affectedRows > 0;
  }
}

// Singleton.
module.exports = new AgendaEventoRepository();
