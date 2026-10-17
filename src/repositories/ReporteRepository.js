/**
 * src/repositories/ReporteRepository.js
 * ---------------------------------------------------------------------
 * SQL de los reportes de desempeno (RF-DES-01..10). Singleton.
 * SQL SOLO aqui; las reglas de formato/validacion viven en
 * reporte.service. Las fases 45-48 van agregando metodos.
 */

const db = require('../config/database');

class ReporteRepository {
  /**
   * RF-DES-01 / RF-DES-02: Top 10 de clientes por GASTO en ventas
   * PAGADAS (solo 'pagada' suma: pendientes y anuladas no cuentan).
   *
   * Se usa LEFT JOIN para que los clientes activos sin ventas tambien
   * aparezcan con gasto 0 al final del ranking; los que ya gastaron
   * siempre encabezan la lista.
   *
   * @param {{vip:boolean, limite?:number}} opciones
   * @returns {Promise<object[]>} filas crudas agrupadas.
   */
  async topClientes({ vip, limite = 10 }) {
    return db.ejecutar(
      `SELECT cl.id_cliente,
              cl.nombre,
              cl.apellido,
              cl.documento,
              cl.email,
              cl.es_vip,
              COUNT(v.id_venta) AS numero_ventas,
              COALESCE(SUM(v.total), 0) AS gasto_total
         FROM clientes cl
         LEFT JOIN ventas v
                ON v.id_cliente = cl.id_cliente
               AND v.estado = 'pagada'
        WHERE cl.estado = 'activo'
          AND cl.es_vip = ?
        GROUP BY cl.id_cliente, cl.nombre, cl.apellido,
                 cl.documento, cl.email, cl.es_vip
        ORDER BY gasto_total DESC, numero_ventas DESC,
                 cl.apellido ASC, cl.nombre ASC
        LIMIT ?`,
      [vip ? 1 : 0, limite]
    );
  }
}

// Singleton.
module.exports = new ReporteRepository();
