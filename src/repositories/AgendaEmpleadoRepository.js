/**
 * src/repositories/AgendaEmpleadoRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de `agenda_empleados`. SQL SOLO aqui.
 * Singleton.
 */

const db = require('../config/database');
const AgendaEmpleado = require('../models/AgendaEmpleado');
const { Filtros } = require('../utils/consulta');
const { ESTADO_AGENDA } = require('../utils/constants');

const SELECT_CON_EMPLEADO = `
  SELECT a.*, CONCAT(e.nombre, ' ', e.apellido) AS nombre_empleado
    FROM agenda_empleados a
    JOIN empleados e ON e.id_empleado = a.id_empleado`;

class AgendaEmpleadoRepository {
  async listar({ estado, idEmpleado, fecha, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('a.estado = ?', estado);
    if (idEmpleado) filtros.agregar('a.id_empleado = ?', idEmpleado);
    if (fecha) filtros.agregar('a.fecha = ?', fecha);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM agenda_empleados a ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_EMPLEADO}
        ${where}
        ORDER BY a.fecha DESC, a.hora_inicio ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(AgendaEmpleado.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `${SELECT_CON_EMPLEADO} WHERE a.id_agenda_empleado = ?`,
      [id]
    );
    return AgendaEmpleado.desdeFila(fila);
  }

  /**
   * ¿El empleado ya tiene un turno que se SUPONE con [horaInicio, horaFin)
   * en esa fecha? Solo chocan los turnos 'programada' o 'completada'
   * (los cancelados no bloquean). `hora_fin` NULL se trata como
   * instante: fin = hora_inicio.
   *
   * @param {number} idEmpleado
   * @param {string} fecha     'YYYY-MM-DD'
   * @param {string} horaInicio 'HH:MM:SS'
   * @param {string|null} horaFin
   * @param {number|null} idExcluido  Turno que se ignora (edicion).
   * @returns {Promise<boolean>}
   */
  async existeSolapamiento(idEmpleado, fecha, horaInicio, horaFin, idExcluido = null) {
    const fin = horaFin ?? horaInicio;

    const sql = idExcluido
      ? `SELECT 1 AS existe FROM agenda_empleados
          WHERE id_empleado = ? AND fecha = ?
            AND id_agenda_empleado <> ?
            AND estado IN (?, ?)
            AND hora_inicio < ?
            AND (hora_fin IS NULL OR hora_fin > ?)`
      : `SELECT 1 AS existe FROM agenda_empleados
          WHERE id_empleado = ? AND fecha = ?
            AND estado IN (?, ?)
            AND hora_inicio < ?
            AND (hora_fin IS NULL OR hora_fin > ?)`;

    const base = [
      idEmpleado,
      fecha,
      ...(idExcluido ? [idExcluido] : []),
      ESTADO_AGENDA.PROGRAMADA,
      ESTADO_AGENDA.COMPLETADA,
      fin,
      horaInicio
    ];

    const fila = await db.obtenerUno(sql, base);
    return Boolean(fila);
  }

  /**
   * Consulta puntual para la asociacion de agenda: ¿existe el evento?
   * (El CRUD completo de `evento` llega en la fase 38.)
   */
  async existeEvento(idEvento) {
    const fila = await db.obtenerUno('SELECT 1 AS existe FROM evento WHERE id_evento = ?', [idEvento]);
    return Boolean(fila);
  }

  /**
   * Cuantos empleados estan asignados al evento (RF-EVE-10).
   * Solo alimenta el log de notificaciones simuladas: la tabla
   * `notificaciones` solo admite clientes, asi que este dato NO se
   * persiste en esa tabla.
   *
   * @param {number} idEvento
   * @returns {Promise<number>}
   */
  async contarPorEvento(idEvento) {
    const fila = await db.obtenerUno(
      'SELECT COUNT(*) AS total FROM agenda_empleados WHERE id_evento = ?',
      [idEvento]
    );
    return Number(fila.total);
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO agenda_empleados
        (id_empleado, id_servicio, id_evento, fecha, hora_inicio, hora_fin, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fila.id_empleado,
        fila.id_servicio,
        fila.id_evento,
        fila.fecha,
        fila.hora_inicio,
        fila.hora_fin,
        fila.estado
      ]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      `UPDATE agenda_empleados
          SET id_empleado = ?, id_servicio = ?, id_evento = ?,
              fecha = ?, hora_inicio = ?, hora_fin = ?, estado = ?
        WHERE id_agenda_empleado = ?`,
      [
        fila.id_empleado,
        fila.id_servicio,
        fila.id_evento,
        fila.fecha,
        fila.hora_inicio,
        fila.hora_fin,
        fila.estado,
        id
      ]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE agenda_empleados SET estado = ? WHERE id_agenda_empleado = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar(
      'DELETE FROM agenda_empleados WHERE id_agenda_empleado = ?',
      [id]
    );
    return resultado.affectedRows > 0;
  }
}

// Singleton.
module.exports = new AgendaEmpleadoRepository();
