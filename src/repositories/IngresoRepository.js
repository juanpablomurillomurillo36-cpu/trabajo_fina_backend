/**
 * src/repositories/IngresoRepository.js
 * ---------------------------------------------------------------------
 * SQL de `ingresos`. Singleton. SQL SOLO aqui.
 */

const db = require('../config/database');
const Ingreso = require('../models/Ingreso');
const { Filtros } = require('../utils/consulta');

const SELECT_CON_JOINS = `
  SELECT i.*,
         CONCAT(c.nombre, ' ', c.apellido) AS nombre_cliente,
         CONCAT(u.nombre, ' ', u.apellido) AS nombre_validador
    FROM ingresos i
    JOIN clientes c ON c.id_cliente = i.id_cliente
    LEFT JOIN usuarios u ON u.id_usuario = i.validado_por`;

class IngresoRepository {
  /** @returns {Promise<{total:number, filas:Ingreso[]}>} */
  async listar({ estado, fecha, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('i.estado = ?', estado);
    if (fecha) filtros.agregar('i.fecha = ?', fecha);
    if (busqueda) {
      filtros.agregarBusquedaMulti(['i.codigo_qr', 'i.puerta_acceso'], busqueda);
    }

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM ingresos i
         JOIN clientes c ON c.id_cliente = i.id_cliente
         ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_JOINS}
        ${where}
        ORDER BY i.fecha DESC, i.hora DESC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Ingreso.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(`${SELECT_CON_JOINS} WHERE i.id_ingreso = ?`, [id]);
    return Ingreso.desdeFila(fila);
  }

  /**
   * ¿Este codigo QR ya se uso para entrar? (la columna es UNIQUE:
   * aqui se hace la deteccion AMIGABLE antes de que MySQL rechace).
   *
   * @param {string} codigo
   * @returns {Promise<boolean>}
   */
  async existePorCodigoQr(codigo) {
    const fila = await db.obtenerUno(
      'SELECT 1 AS existe FROM ingresos WHERE codigo_qr = ?',
      [codigo]
    );
    return Boolean(fila);
  }

  /** @returns {Promise<number>} id del ingreso creado. */
  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO ingresos
        (id_cliente, id_reserva, codigo_qr, fecha, hora, puerta_acceso,
         tipo_dispositivo, validado_por, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fila.id_cliente,
        fila.id_reserva,
        fila.codigo_qr,
        fila.fecha,
        fila.hora,
        fila.puerta_acceso,
        fila.tipo_dispositivo,
        fila.validado_por,
        fila.estado
      ]
    );
    return resultado.insertId;
  }
}

// Singleton.
module.exports = new IngresoRepository();
