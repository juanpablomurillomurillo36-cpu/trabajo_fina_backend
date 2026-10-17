/**
 * src/repositories/ServicioRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de `servicios`. SQL SOLO aqui con `?` posicionales.
 * Singleton.
 */

const db = require('../config/database');
const Servicio = require('../models/Servicio');
const { Filtros } = require('../utils/consulta');
const { ESTADO } = require('../utils/constants');

class ServicioRepository {
  async listar({ estado, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('s.estado = ?', estado);
    if (busqueda) filtros.agregarBusquedaMulti(['s.nombre', 's.descripcion'], busqueda);

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM servicios s ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `SELECT s.* FROM servicios s
        ${where}
        ORDER BY s.nombre ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Servicio.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno('SELECT * FROM servicios WHERE id_servicio = ?', [id]);
    return Servicio.desdeFila(fila);
  }

  /** Nombre unico solo entre activos (regla en servicio, C-02). */
  async existeNombre(nombre, idExcluido = null) {
    const sql = idExcluido
      ? `SELECT 1 AS existe FROM servicios
          WHERE nombre = ? AND estado = 'activo' AND id_servicio <> ?`
      : `SELECT 1 AS existe FROM servicios WHERE nombre = ? AND estado = 'activo'`;
    const params = idExcluido ? [nombre, idExcluido] : [nombre];

    const fila = await db.obtenerUno(sql, params);
    return Boolean(fila);
  }

  /**
   * Lineas que referencian el servicio en sus 3 tablas consumidoras.
   * Las tres consultas corren en paralelo (Promise.all).
   *
   * @returns {Promise<{reservas:number, agenda:number, fichas:number}>}
   */
  async contarUsos(id) {
    const [reservas, agenda, fichas] = await Promise.all([
      db.obtenerUno('SELECT COUNT(*) AS total FROM detalle_reserva WHERE id_servicio = ?', [id]),
      db.obtenerUno('SELECT COUNT(*) AS total FROM agenda_empleados WHERE id_servicio = ?', [id]),
      db.obtenerUno('SELECT COUNT(*) AS total FROM ficha_servicio WHERE id_servicio = ?', [id])
    ]);

    return {
      reservas: Number(reservas.total),
      agenda: Number(agenda.total),
      fichas: Number(fichas.total)
    };
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO servicios (nombre, descripcion, precio, estado)
       VALUES (?, ?, ?, ?)`,
      [fila.nombre, fila.descripcion, fila.precio, fila.estado]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      `UPDATE servicios SET nombre = ?, descripcion = ?, precio = ?, estado = ?
        WHERE id_servicio = ?`,
      [fila.nombre, fila.descripcion, fila.precio, fila.estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE servicios SET estado = ? WHERE id_servicio = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar('DELETE FROM servicios WHERE id_servicio = ?', [id]);
    return resultado.affectedRows > 0;
  }

  async listarTodos(estado = ESTADO.ACTIVO) {
    const filas = await db.ejecutar(
      `SELECT * FROM servicios ${estado ? 'WHERE estado = ?' : ''} ORDER BY nombre ASC`,
      estado ? [estado] : []
    );
    return filas.map(Servicio.desdeFila);
  }
}

// Singleton.
module.exports = new ServicioRepository();
