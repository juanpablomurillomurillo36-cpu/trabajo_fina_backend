/**
 * src/repositories/CompraRepository.js
 * ---------------------------------------------------------------------
 * SQL de `compras`. Las escrituras multi-tabla (compra + detalles)
 * usan db.conTransaccion y delegan las lineas a
 * DetalleCompraRepository (composicion P4: todo o nada).
 * Singleton.
 */

const db = require('../config/database');
const Compra = require('../models/Compra');
const DetalleCompra = require('../models/DetalleCompra');
const detalleCompraRepository = require('./DetalleCompraRepository');
const { Filtros } = require('../utils/consulta');

const SELECT_CON_PROVEEDOR = `
  SELECT c.*, pr.nombre AS nombre_proveedor
    FROM compras c
    JOIN proveedores pr ON pr.id_proveedor = c.id_proveedor`;

class CompraRepository {
  async listar({ estado, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('c.estado = ?', estado);
    if (busqueda) {
      filtros.agregarBusquedaMulti(['pr.nombre', 'pr.nit'], busqueda);
    }

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM compras c
         JOIN proveedores pr ON pr.id_proveedor = c.id_proveedor
        ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_PROVEEDOR}
        ${where}
        ORDER BY c.fecha_compra DESC, c.id_compra DESC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Compra.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(`${SELECT_CON_PROVEEDOR} WHERE c.id_compra = ?`, [id]);
    return Compra.desdeFila(fila);
  }

  /**
   * Compra + sus lineas (dos consultas en paralelo).
   *
   * @returns {Promise<Compra|null>}
   */
  async obtenerConDetalles(id) {
    const [compra, detalles] = await Promise.all([
      this.obtenerPorId(id),
      detalleCompraRepository.listarPorCompra(id)
    ]);

    if (compra === null) return null;

    compra.detalles = detalles;
    compra.recalcularTotal();
    return compra;
  }

  /**
   * Alta COMPLETA (compra + lineas) en UNA transaccion.
   * Si cualquier INSERT falla, no queda ni la compra ni ninguna linea.
   *
   * @param {object} datosCompras snake_case de la compra.
   * @param {DetalleCompra[]} detalles
   * @returns {Promise<number>} id de la compra creada.
   */
  async crearConDetalles(datosCompras, detalles) {
    return db.conTransaccion(async (conexion) => {
      // OJO: `fecha_compra` NO se pone en el INSERT: es NOT NULL con
      // DEFAULT CURRENT_TIMESTAMP (ponerla en NULL romperia la regla).
      const [resultado] = await conexion.execute(
        `INSERT INTO compras (id_proveedor, total, estado)
         VALUES (?, ?, ?)`,
        [datosCompras.id_proveedor, datosCompras.total, datosCompras.estado]
      );

      const idCompra = resultado.insertId;
      await detalleCompraRepository.insertarVarios(conexion, idCompra, detalles);

      return idCompra;
    });
  }

  /**
   * Edicion COMPLETA en transaccion: cabecera + reemplazo total de
   * lineas (composicion: el detalle no se edita por partes).
   *
   * @param {number} id
   * @param {object} datosCompras
   * @param {DetalleCompra[]} detalles
   */
  async actualizarConDetalles(id, datosCompras, detalles) {
    await db.conTransaccion(async (conexion) => {
      await conexion.execute(
        `UPDATE compras
            SET id_proveedor = ?, total = ?, estado = ?
          WHERE id_compra = ?`,
        [datosCompras.id_proveedor, datosCompras.total, datosCompras.estado, id]
      );

      await detalleCompraRepository.eliminarPorCompra(conexion, id);
      await detalleCompraRepository.insertarVarios(conexion, id, detalles);
    });
  }

  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE compras SET estado = ? WHERE id_compra = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  /**
   * CONFIRMAR compra (RN-01) en UNA transaccion:
   *   1. suma el stock de cada producto de sus lineas;
   *   2. pasa la compra a 'confirmada'.
   * Si CUALQUIER paso falla, no se suma stock ni se cambia estado
   * (rollback automatico de db.conTransaccion).
   *
   * @param {number} id
   * @param {Array<{idProducto:number, cantidad:number}>} lineas
   */
  async confirmarEnTransaccion(id, lineas) {
    await db.conTransaccion(async (conexion) => {
      for (const linea of lineas) {
        const [resultado] = await conexion.execute(
          'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          [linea.cantidad, linea.idProducto]
        );

        if (resultado.affectedRows === 0) {
          // Dispara el rollback: no existe (o desaparecio) el producto.
          throw new Error(`No se pudo sumar stock del producto ${linea.idProducto}`);
        }
      }

      const [resultadoCompra] = await conexion.execute(
        'UPDATE compras SET estado = ? WHERE id_compra = ?',
        ['confirmada', id]
      );

      if (resultadoCompra.affectedRows === 0) {
        throw new Error('La compra dejo de existir durante la confirmacion');
      }
    });
  }

  /**
   * Baja fisica (los detalles caen en cascada por la FK
   * `fk_detcompra_compra ... ON DELETE CASCADE`).
   */
  async eliminar(id) {
    const resultado = await db.ejecutar('DELETE FROM compras WHERE id_compra = ?', [id]);
    return resultado.affectedRows > 0;
  }
}

// Singleton.
module.exports = new CompraRepository();
