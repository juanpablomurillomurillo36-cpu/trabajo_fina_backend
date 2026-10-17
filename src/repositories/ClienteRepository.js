/**
 * src/repositories/ClienteRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de `clientes`. SQL SOLO aqui con `?` posicionales.
 * Singleton.
 */

const db = require('../config/database');
const Cliente = require('../models/Cliente');
const { Filtros } = require('../utils/consulta');
const { ESTADO } = require('../utils/constants');

// JOIN con la categoria para devolver tambien su nombre.
const SELECT_CON_CATEGORIA = `
  SELECT cl.*, cc.nombre AS nombre_categoria
    FROM clientes cl
    JOIN categoria_clientes cc ON cc.id_categoria_cliente = cl.id_categoria_cliente`;

class ClienteRepository {
  async listar({ estado, busqueda, idCategoria, esVip, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('cl.estado = ?', estado);
    if (idCategoria) filtros.agregar('cl.id_categoria_cliente = ?', idCategoria);
    if (esVip !== null && esVip !== undefined) filtros.agregar('cl.es_vip = ?', esVip);
    if (busqueda) {
      filtros.agregarBusquedaMulti(
        ['cl.nombre', 'cl.apellido', 'cl.documento', 'cl.email'],
        busqueda
      );
    }

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM clientes cl ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_CATEGORIA}
        ${where}
        ORDER BY cl.apellido ASC, cl.nombre ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Cliente.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `${SELECT_CON_CATEGORIA} WHERE cl.id_cliente = ?`,
      [id]
    );
    return Cliente.desdeFila(fila);
  }

  /** Documento unico a nivel de tabla (indice `uq_clientes_documento`). */
  async existeDocumento(documento, idExcluido = null) {
    const sql = idExcluido
      ? 'SELECT 1 AS existe FROM clientes WHERE documento = ? AND id_cliente <> ?'
      : 'SELECT 1 AS existe FROM clientes WHERE documento = ?';
    const params = idExcluido ? [documento, idExcluido] : [documento];

    const fila = await db.obtenerUno(sql, params);
    return Boolean(fila);
  }

  /**
   * Registros que referencian al cliente en SUS 5 tablas consumidoras.
   * Las cinco consultas corren en paralelo (Promise.all, R-ASYNC).
   *
   * @returns {Promise<{reservas:number, ventas:number, ingresos:number, puntos:number, notificaciones:number}>}
   */
  async contarUsos(id) {
    const [reservas, ventas, ingresos, puntos, notificaciones] = await Promise.all([
      db.obtenerUno('SELECT COUNT(*) AS total FROM reservas WHERE id_cliente = ?', [id]),
      db.obtenerUno('SELECT COUNT(*) AS total FROM ventas WHERE id_cliente = ?', [id]),
      db.obtenerUno('SELECT COUNT(*) AS total FROM ingresos WHERE id_cliente = ?', [id]),
      db.obtenerUno('SELECT COUNT(*) AS total FROM programa_puntos WHERE id_cliente = ?', [id]),
      db.obtenerUno('SELECT COUNT(*) AS total FROM notificaciones WHERE id_cliente = ?', [id])
    ]);

    return {
      reservas: Number(reservas.total),
      ventas: Number(ventas.total),
      ingresos: Number(ingresos.total),
      puntos: Number(puntos.total),
      notificaciones: Number(notificaciones.total)
    };
  }

  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO clientes
        (id_categoria_cliente, nombre, apellido, documento, telefono, email,
         fecha_nacimiento, es_vip, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fila.id_categoria_cliente,
        fila.nombre,
        fila.apellido,
        fila.documento,
        fila.telefono,
        fila.email,
        fila.fecha_nacimiento,
        fila.es_vip,
        fila.estado
      ]
    );
    return resultado.insertId;
  }

  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      `UPDATE clientes
          SET id_categoria_cliente = ?, nombre = ?, apellido = ?, documento = ?,
              telefono = ?, email = ?, fecha_nacimiento = ?, es_vip = ?, estado = ?
        WHERE id_cliente = ?`,
      [
        fila.id_categoria_cliente,
        fila.nombre,
        fila.apellido,
        fila.documento,
        fila.telefono,
        fila.email,
        fila.fecha_nacimiento,
        fila.es_vip,
        fila.estado,
        id
      ]
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE clientes SET estado = ? WHERE id_cliente = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await db.ejecutar('DELETE FROM clientes WHERE id_cliente = ?', [id]);
    return resultado.affectedRows > 0;
  }

  async listarTodos(estado = ESTADO.ACTIVO) {
    const filas = await db.ejecutar(
      `${SELECT_CON_CATEGORIA} ${estado ? 'WHERE cl.estado = ?' : ''}
        ORDER BY cl.apellido ASC`,
      estado ? [estado] : []
    );
    return filas.map(Cliente.desdeFila);
  }
}

// Singleton.
module.exports = new ClienteRepository();
