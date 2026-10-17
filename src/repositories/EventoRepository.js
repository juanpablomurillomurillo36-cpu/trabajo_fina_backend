/**
 * src/repositories/EventoRepository.js
 * ---------------------------------------------------------------------
 * SQL de `evento`. Singleton. SQL SOLO aqui.
 */

const db = require('../config/database');
const Evento = require('../models/Evento');
const { Filtros } = require('../utils/consulta');

class EventoRepository {
  /** @returns {Promise<{total:number, filas:Evento[]}>} */
  async listar({ estado, fecha, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('estado = ?', estado);
    if (fecha) filtros.agregar('fecha = ?', fecha);
    if (busqueda) filtros.agregarBusquedaMulti(['nombre', 'tematica'], busqueda);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM evento ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `SELECT * FROM evento ${where}
        ORDER BY fecha DESC, hora_inicio ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Evento.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno('SELECT * FROM evento WHERE id_evento = ?', [id]);
    return Evento.desdeFila(fila);
  }

  /**
   * ¿El evento ya tiene ficha tecnica? (RN-07: no se puede borrar el
   * evento sin borrar antes su ficha).
   */
  async tieneFichaTecnica(id) {
    const fila = await db.obtenerUno(
      'SELECT 1 AS existe FROM ficha_tecnica WHERE id_evento = ?',
      [id]
    );
    return Boolean(fila);
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO evento (nombre, tematica, fecha, hora_inicio, hora_fin, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fila.nombre, fila.tematica, fila.fecha, fila.hora_inicio, fila.hora_fin, fila.estado]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      `UPDATE evento
          SET nombre = ?, tematica = ?, fecha = ?, hora_inicio = ?, hora_fin = ?, estado = ?
        WHERE id_evento = ?`,
      [fila.nombre, fila.tematica, fila.fecha, fila.hora_inicio, fila.hora_fin, fila.estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE evento SET estado = ? WHERE id_evento = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar('DELETE FROM evento WHERE id_evento = ?', [id]);
    return resultado.affectedRows > 0;
  }
}

// Singleton.
module.exports = new EventoRepository();
