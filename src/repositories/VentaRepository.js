/**
 * src/repositories/VentaRepository.js
 * ---------------------------------------------------------------------
 * SQL de `ventas` (cabecera de la composicion). Singleton.
 *
 * `fecha_venta` NO se pone en el INSERT: es NOT NULL con DEFAULT
 * CURRENT_TIMESTAMP. La fase 42 agregara pagarEnTransaccion.
 */

const db = require('../config/database');
const Venta = require('../models/Venta');
const DetalleVenta = require('./DetalleVentaRepository');
const AppError = require('../utils/AppError');
const { Filtros } = require('../utils/consulta');

const SELECT_CON_CLIENTE = `
  SELECT v.*, CONCAT(c.nombre, ' ', c.apellido) AS nombre_cliente
    FROM ventas v
    JOIN clientes c ON c.id_cliente = v.id_cliente`;

class VentaRepository {
  /** @returns {Promise<{total:number, filas:Venta[]}>} */
  async listar({ estado, idCliente, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('v.estado = ?', estado);
    if (idCliente) filtros.agregar('v.id_cliente = ?', idCliente);
    if (busqueda) {
      filtros.agregarBusquedaMulti(['v.comprobante_no', 'c.documento', 'c.nombre'], busqueda);
    }

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // db.obtenerUno devuelve la FILA, no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM ventas v
         JOIN clientes c ON c.id_cliente = v.id_cliente
         ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `${SELECT_CON_CLIENTE}
        ${where}
        ORDER BY v.id_venta DESC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return { total: Number(totalFila.total), filas: filas.map(Venta.desdeFila) };
  }

  async obtenerPorId(id) {
    const fila = await db.obtenerUno(`${SELECT_CON_CLIENTE} WHERE v.id_venta = ?`, [id]);
    return Venta.desdeFila(fila);
  }

  /**
   * Cabecera CON sus lineas (lectura natural de la composicion).
   *
   * @param {number} id
   * @returns {Promise<Venta|null>}
   */
  async obtenerConDetalles(id) {
    const [venta, detalles] = await Promise.all([
      this.obtenerPorId(id),
      DetalleVenta.listarPorVenta(id)
    ]);

    if (venta === null) return null;

    venta.detalles = detalles;
    return venta;
  }

  /**
   * Alta COMPLETA (venta + lineas) en UNA transaccion.
   *
   * @param {object} datosVenta snake_case de la cabecera.
   * @param {DetalleVenta[]} detalles
   * @returns {Promise<number>} id de la venta creada.
   */
  async crearConDetalles(datosVenta, detalles) {
    return db.conTransaccion(async (conexion) => {
      const [resultado] = await conexion.execute(
        `INSERT INTO ventas (id_cliente, total, metodo_pago, estado)
         VALUES (?, ?, ?, ?)`,
        [datosVenta.id_cliente, datosVenta.total, datosVenta.metodo_pago, datosVenta.estado]
      );

      const idVenta = resultado.insertId;
      await DetalleVenta.insertarVarios(conexion, idVenta, detalles);

      return idVenta;
    });
  }

  /**
   * Edicion COMPLETA en transaccion: cabecera + reemplazo total de
   * lineas (la composicion no se edita por partes).
   *
   * @param {number} id
   * @param {object} datosVenta
   * @param {DetalleVenta[]} detalles
   */
  async actualizarConDetalles(id, datosVenta, detalles) {
    await db.conTransaccion(async (conexion) => {
      await conexion.execute(
        `UPDATE ventas
            SET id_cliente = ?, total = ?, metodo_pago = ?
          WHERE id_venta = ?`,
        [datosVenta.id_cliente, datosVenta.total, datosVenta.metodo_pago, id]
      );

      await DetalleVenta.eliminarPorVenta(conexion, id);
      await DetalleVenta.insertarVarios(conexion, id, detalles);
    });
  }

  /**
   * PAGAR (RN-09/RN-10) en UNA transaccion:
   *   1. descuenta el stock de cada producto de sus lineas;
   *   2. guarda el total CON IVA y el comprobante unico;
   *   3. pasa la venta a 'pagada'.
   * Si CUALQUIER paso falla, no se descuenta stock ni se marca pagada
   * (rollback automatico de db.conTransaccion). El descuento lleva la
   * guarda `stock_actual >= ?`: una carrera que agotara el stock haria
   * affectedRows = 0 y aborta la transaccion.
   *
   * @param {number} id
   * @param {{total:number, comprobanteNo:string}} datosPago
   * @param {Array<{idProducto:number, cantidad:number}>} lineas
   */
  async pagarEnTransaccion(id, datosPago, lineas) {
    await db.conTransaccion(async (conexion) => {
      for (const linea of lineas) {
        const [resultado] = await conexion.execute(
          `UPDATE productos SET stock_actual = stock_actual - ?
            WHERE id_producto = ? AND stock_actual >= ?`,
          [linea.cantidad, linea.idProducto, linea.cantidad]
        );

        if (resultado.affectedRows === 0) {
          // Defensa contra carreras: el pre-chequeo amigable vive en
          // el service; aqui solo se aborta la transaccion.
          throw AppError.conflicto('No hay stock suficiente para descontar');
        }
      }

      const [resultadoVenta] = await conexion.execute(
        `UPDATE ventas
            SET total = ?, comprobante_no = ?, estado = 'pagada'
          WHERE id_venta = ? AND estado = 'pendiente'`,
        [datosPago.total, datosPago.comprobanteNo, id]
      );

      if (resultadoVenta.affectedRows === 0) {
        throw AppError.conflicto('La venta ya no esta pendiente');
      }
    });
  }

  /**
   * ANULAR (RN-09) en UNA transaccion. Si la venta estaba PAGADA se
   * devuelve su stock lineas arriba; si estaba pendiente no habia
   * descontado nada. Estado destino: 'anulada'.
   *
   * @param {number} id
   * @param {boolean} restaurarStock
   * @param {Array<{idProducto:number, cantidad:number}>} lineas
   */
  async anularEnTransaccion(id, restaurarStock, lineas) {
    await db.conTransaccion(async (conexion) => {
      const [resultado] = await conexion.execute(
        `UPDATE ventas
            SET estado = 'anulada'
          WHERE id_venta = ? AND estado IN ('pendiente', 'pagada')`,
        [id]
      );

      if (resultado.affectedRows === 0) {
        throw AppError.conflicto('La venta ya esta anulada');
      }

      if (restaurarStock) {
        for (const linea of lineas) {
          await conexion.execute(
            'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            [linea.cantidad, linea.idProducto]
          );
        }
      }
    });
  }

  /** Baja fisica; las lineas caen en cascada (ON DELETE CASCADE). */
  async eliminar(id) {
    const resultado = await db.ejecutar('DELETE FROM ventas WHERE id_venta = ?', [id]);
    return resultado.affectedRows > 0;
  }
}

// Singleton.
module.exports = new VentaRepository();
