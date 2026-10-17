/**
 * src/repositories/ReservaRepository.js
 * ---------------------------------------------------------------------
 * SQL de `reservas` (cabecera de la composicion). Singleton.
 *
 * El indice UNICO uq_reserva_espacio_horario garantiza que un mismo
 * espacio no tenga dos reservas en la misma fecha y hora; la fase 34
 * agregara la deteccion amigable ANTES de llegar a MySQL.
 */

const db = require('../config/database');
const Reserva = require('../models/Reserva');
const DetalleReserva = require('./DetalleReservaRepository');
const { Filtros } = require('../utils/consulta');

const SELECT_CON_CLIENTE = `
  SELECT r.*, CONCAT(c.nombre, ' ', c.apellido) AS nombre_cliente
    FROM reservas r
    JOIN clientes c ON c.id_cliente = r.id_cliente`;

class ReservaRepository {
  /** @returns {Promise<{total:number, filas:Reserva[]}>} */
  async listar({ estado, idCliente, fecha, tipoEspacio, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('r.estado = ?', estado);
    if (idCliente) filtros.agregar('r.id_cliente = ?', idCliente);
    if (fecha) filtros.agregar('r.fecha = ?', fecha);
    if (tipoEspacio) filtros.agregar('r.tipo_espacio = ?', tipoEspacio);
    if (busqueda) filtros.agregarBusquedaMulti(['r.identificador_espacio', 'c.documento'], busqueda);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM reservas r
         JOIN clientes c ON c.id_cliente = r.id_cliente
         ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_CLIENTE}
        ${where}
        ORDER BY r.fecha DESC, r.hora ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Reserva.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `${SELECT_CON_CLIENTE} WHERE r.id_reserva = ?`,
      [id]
    );
    return Reserva.desdeFila(fila);
  }

  /**
   * Cabecera CON sus lineas (la lectura natural de una composicion).
   * Ambas lecturas ocurren en paralelo: son independientes entre si.
   *
   * @param {number} id
   * @returns {Promise<Reserva|null>}
   */
  async obtenerConDetalles(id) {
    const [reserva, detalles] = await Promise.all([
      this.obtenerPorId(id),
      DetalleReserva.listarPorReserva(id)
    ]);

    if (reserva === null) return null;

    reserva.detalles = detalles;
    return reserva;
  }

  /**
   * Alta COMPLETA (reserva + lineas) en UNA transaccion: o entran las
   * dos o no entra ninguna.
   *
   * @param {object} datosReserva snake_case de la cabecera.
   * @param {DetalleReserva[]} detalles
   * @returns {Promise<number>} id de la reserva creada.
   */
  async crearConDetalles(datosReserva, detalles) {
    return db.conTransaccion(async (conexion) => {
      const [resultado] = await conexion.execute(
        `INSERT INTO reservas
          (id_cliente, tipo_espacio, identificador_espacio, fecha, hora, descuento, subtotal, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          datosReserva.id_cliente,
          datosReserva.tipo_espacio,
          datosReserva.identificador_espacio,
          datosReserva.fecha,
          datosReserva.hora,
          datosReserva.descuento,
          datosReserva.subtotal,
          datosReserva.estado
        ]
      );

      const idReserva = resultado.insertId;
      await DetalleReserva.insertarVarios(conexion, idReserva, detalles);

      return idReserva;
    });
  }

  /**
   * Edicion COMPLETA en transaccion: cabecera + reemplazo total de
   * lineas (la composicion no se edita por partes).
   *
   * @param {number} id
   * @param {object} datosReserva
   * @param {DetalleReserva[]} detalles
   */
  async actualizarConDetalles(id, datosReserva, detalles) {
    await db.conTransaccion(async (conexion) => {
      await conexion.execute(
        `UPDATE reservas
            SET id_cliente = ?, tipo_espacio = ?, identificador_espacio = ?,
                fecha = ?, hora = ?, descuento = ?, subtotal = ?, estado = ?
          WHERE id_reserva = ?`,
        [
          datosReserva.id_cliente,
          datosReserva.tipo_espacio,
          datosReserva.identificador_espacio,
          datosReserva.fecha,
          datosReserva.hora,
          datosReserva.descuento,
          datosReserva.subtotal,
          datosReserva.estado,
          id
        ]
      );

      await DetalleReserva.eliminarPorReserva(conexion, id);
      await DetalleReserva.insertarVarios(conexion, id, detalles);
    });
  }

  /**
   * ¿Existe ya una reserva para MISMO espacio + fecha + hora? Es la
   * version amigable (409) del indice unico uq_reserva_espacio_horario:
   * se avisa ANTES de que MySQL rechace el INSERT. Cualquier estado
   * cuenta, exactamente igual que el indice (una reserva cancelada
   * conserva su llave y sigue bloqueando ese horario).
   *
   * @param {object} datos
   * @param {number|null} [idExcluido]  Reserva que se ignora (edicion).
   * @returns {Promise<boolean>}
   */
  async existeConflicto({ tipoEspacio, identificadorEspacio, fecha, hora }, idExcluido = null) {
    const sql = idExcluido
      ? `SELECT 1 AS existe FROM reservas
          WHERE tipo_espacio = ? AND identificador_espacio = ?
            AND fecha = ? AND hora = ? AND id_reserva <> ?`
      : `SELECT 1 AS existe FROM reservas
          WHERE tipo_espacio = ? AND identificador_espacio = ?
            AND fecha = ? AND hora = ?`;

    const parametros = [tipoEspacio, identificadorEspacio, fecha, hora];
    if (idExcluido) parametros.push(idExcluido);

    const fila = await db.obtenerUno(sql, parametros);
    return Boolean(fila);
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE reservas SET estado = ? WHERE id_reserva = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  /** Baja fisica; las lineas caen en cascada (ON DELETE CASCADE). */
  async eliminar(id) {
    const resultado = await db.ejecutar('DELETE FROM reservas WHERE id_reserva = ?', [id]);
    return resultado.affectedRows > 0;
  }
}

// Singleton.
module.exports = new ReservaRepository();
