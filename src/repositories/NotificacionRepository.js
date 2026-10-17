/**
 * src/repositories/NotificacionRepository.js
 * ---------------------------------------------------------------------
 * SQL de `notificaciones`. Singleton. SQL SOLO aqui.
 *
 * RN-12 es SIMULADA: aqui solo se persiste; quien "envia" (en
 * realidad registra) es NotificacionService.
 */

const db = require('../config/database');
const Notificacion = require('../models/Notificacion');
const { Filtros } = require('../utils/consulta');

const SELECT_CON_CLIENTE = `
  SELECT n.*, CONCAT(c.nombre, ' ', c.apellido) AS nombre_cliente
    FROM notificaciones n
    JOIN clientes c ON c.id_cliente = n.id_cliente`;

class NotificacionRepository {
  /** @returns {Promise<{total:number, filas:Notificacion[]}>} */
  async listar({ tipo, canal, estado, idCliente, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (tipo) filtros.agregar('n.tipo = ?', tipo);
    if (canal) filtros.agregar('n.canal = ?', canal);
    if (estado) filtros.agregar('n.estado = ?', estado);
    if (idCliente) filtros.agregar('n.id_cliente = ?', idCliente);
    if (busqueda) filtros.agregarBusqueda('n.mensaje', busqueda);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM notificaciones n
         JOIN clientes c ON c.id_cliente = n.id_cliente
         ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_CLIENTE}
        ${where}
        ORDER BY n.id_notificacion DESC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Notificacion.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(`${SELECT_CON_CLIENTE} WHERE n.id_notificacion = ?`, [id]);
    return Notificacion.desdeFila(fila);
  }

  /** @returns {Promise<number>} id creada. */
  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO notificaciones (id_cliente, tipo, canal, mensaje, fecha_envio, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fila.id_cliente, fila.tipo, fila.canal, fila.mensaje, fila.fecha_envio, fila.estado]
    );
    return resultado.insertId;
  }

  /**
   * Varias notificaciones de golpe (masiva del evento nuevo).
   *
   * @param {Notificacion[]} notificaciones
   * @returns {Promise<number>} cuantas se insertaron.
   */
  async insertarVarias(notificaciones) {
    let insertadas = 0;

    for (const notificacion of notificaciones) {
      await this.crear(notificacion.aFilaInsercion());
      insertadas += 1;
    }

    return insertadas;
  }
}

// Singleton.
module.exports = new NotificacionRepository();
