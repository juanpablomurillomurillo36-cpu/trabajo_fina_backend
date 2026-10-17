/**
 * src/repositories/ReporteRepository.js
 * ---------------------------------------------------------------------
 * SQL de los reportes de desempeno (RF-DES-01..10). Singleton.
 * SQL SOLO aqui; las reglas de formato/validacion viven en
 * reporte.service. Las fases 45-48 van agregando metodos.
 */

const db = require('../config/database');
const { Filtros } = require('../utils/consulta');

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

  /**
   * RF-DES-03 / RF-DES-04: unidades solicitadas POR SERVICIO
   * (SUM(cantidad) de `detalle_reserva`).
   *
   *  - las reservas CANCELADAS no cuentan: un servicio cancelado no
   *    fue realmente "solicitado".
   *  - LEFT JOIN desde servicios: los servicios nunca reservados
   *    aparecen con 0 y son candidatos a "menos solicitados".
   *
   * @param {{limite?:number}} opciones  limite por lista (mas/menos).
   * @returns {Promise<object[]>} filas con unidades_solicitadas.
   */
  async serviciosSolicitados({ limite = 10 }) {
    return db.ejecutar(
      `SELECT s.id_servicio,
              s.nombre,
              s.precio,
              s.estado,
              COALESCE(d.unidades, 0) AS unidades_solicitadas,
              COALESCE(d.reservas, 0) AS numero_reservas
         FROM servicios s
         LEFT JOIN (
           SELECT dr.id_servicio,
                  SUM(dr.cantidad) AS unidades,
                  COUNT(DISTINCT dr.id_reserva) AS reservas
             FROM detalle_reserva dr
             JOIN reservas r ON r.id_reserva = dr.id_reserva
                          AND r.estado <> 'cancelada'
            GROUP BY dr.id_servicio
         ) d ON d.id_servicio = s.id_servicio
        ORDER BY unidades_solicitadas DESC, numero_reservas DESC,
                 s.nombre ASC
        LIMIT ?`,
      [limite]
    );
  }

  /**
   * Inverso de serviciosSolicitados: las MENOS solicitadas (ASC).
   * Misma fuente de datos; solo cambia el orden.
   *
   * @param {{limite?:number}} opciones
   * @returns {Promise<object[]>}
   */
  async serviciosMenosSolicitados({ limite = 10 }) {
    return db.ejecutar(
      `SELECT s.id_servicio,
              s.nombre,
              s.precio,
              s.estado,
              COALESCE(d.unidades, 0) AS unidades_solicitadas,
              COALESCE(d.reservas, 0) AS numero_reservas
         FROM servicios s
         LEFT JOIN (
           SELECT dr.id_servicio,
                  SUM(dr.cantidad) AS unidades,
                  COUNT(DISTINCT dr.id_reserva) AS reservas
             FROM detalle_reserva dr
             JOIN reservas r ON r.id_reserva = dr.id_reserva
                          AND r.estado <> 'cancelada'
            GROUP BY dr.id_servicio
         ) d ON d.id_servicio = s.id_servicio
        ORDER BY unidades_solicitadas ASC, numero_reservas ASC,
                 s.nombre ASC
        LIMIT ?`,
      [limite]
    );
  }

  /**
   * RF-DES-05: Top 3 de productos MENOS vendidos por unidades
   * (SUM(cantidad) de `detalle_ventas` de ventas PAGADAS).
   *
   * La subconsulta filtra 'pagada' ANTES de agregar: si el JOIN se
   * hiciera con la condicion en el ON, las lineas de ventas no pagadas
   * seguirian sumando. Los productos jamas vendidos quedan en 0 y
   * aparecen primero (son literalmente los menos vendidos).
   *
   * @returns {Promise<object[]>} siempre 3 filas (o las que haya).
   */
  async productosMenosVendidos() {
    return db.ejecutar(
      `SELECT p.id_producto,
              p.nombre,
              p.precio_venta,
              p.stock_actual,
              p.estado,
              COALESCE(d.unidades, 0) AS unidades_vendidas
         FROM productos p
         LEFT JOIN (
           SELECT dv.id_producto,
                  SUM(dv.cantidad) AS unidades
             FROM detalle_ventas dv
             JOIN ventas v ON v.id_venta = dv.id_venta
                          AND v.estado = 'pagada'
            GROUP BY dv.id_producto
         ) d ON d.id_producto = p.id_producto
        ORDER BY unidades_vendidas ASC, p.nombre ASC
        LIMIT 3`
    );
  }

  /**
   * RF-DES-06: ventas PAGADAS mes a mes (serie historica).
   * Solo 'pagada': pendientes no son ingreso y las anuladas se
   * devolvieron.
   *
   * @param {number|null} anio  filtro opcional de anio.
   * @returns {Promise<object[]>} filas {anio, mes, total, numero_ventas}.
   */
  async ventasPorMes(anio = null) {
    const filtros = new Filtros();
    filtros.agregar("v.estado = 'pagada'");
    if (anio !== null) filtros.agregar('YEAR(v.fecha_venta) = ?', anio);

    return db.ejecutar(
      `SELECT YEAR(v.fecha_venta) AS anio,
              MONTH(v.fecha_venta) AS mes,
              SUM(v.total) AS total,
              COUNT(v.id_venta) AS numero_ventas
         FROM ventas v
        ${filtros.obtenerWhere()}
        GROUP BY YEAR(v.fecha_venta), MONTH(v.fecha_venta)
        ORDER BY anio ASC, mes ASC`,
      filtros.obtenerParametros()
    );
  }

  /**
   * RF-DES-07 / RF-DES-08: dia y mes de MAYOR y MENOR venta (pagadas).
   * Cuatro consultas simples con LIMIT 1; los empates los resuelve la
   * fecha mas antigua (ASC) para que el reporte sea determinista.
   *
   * @returns {Promise<object>} {mayorDia, menorDia, mayorMes, menorMes}.
   */
  async mayorMenorVentas() {
    const [mayorDia, menorDia, mayorMes, menorMes] = await Promise.all([
      db.obtenerUno(
        `SELECT DATE(v.fecha_venta) AS fecha,
                SUM(v.total) AS total,
                COUNT(v.id_venta) AS numero_ventas
           FROM ventas v
          WHERE v.estado = 'pagada'
          GROUP BY DATE(v.fecha_venta)
          ORDER BY total DESC, fecha ASC
          LIMIT 1`
      ),
      db.obtenerUno(
        `SELECT DATE(v.fecha_venta) AS fecha,
                SUM(v.total) AS total,
                COUNT(v.id_venta) AS numero_ventas
           FROM ventas v
          WHERE v.estado = 'pagada'
          GROUP BY DATE(v.fecha_venta)
          ORDER BY total ASC, fecha ASC
          LIMIT 1`
      ),
      db.obtenerUno(
        `SELECT YEAR(v.fecha_venta) AS anio,
                MONTH(v.fecha_venta) AS mes,
                SUM(v.total) AS total,
                COUNT(v.id_venta) AS numero_ventas
           FROM ventas v
          WHERE v.estado = 'pagada'
          GROUP BY YEAR(v.fecha_venta), MONTH(v.fecha_venta)
          ORDER BY total DESC, anio ASC, mes ASC
          LIMIT 1`
      ),
      db.obtenerUno(
        `SELECT YEAR(v.fecha_venta) AS anio,
                MONTH(v.fecha_venta) AS mes,
                SUM(v.total) AS total,
                COUNT(v.id_venta) AS numero_ventas
           FROM ventas v
          WHERE v.estado = 'pagada'
          GROUP BY YEAR(v.fecha_venta), MONTH(v.fecha_venta)
          ORDER BY total ASC, anio ASC, mes ASC
          LIMIT 1`
      )
    ]);

    return { mayorDia, menorDia, mayorMes, menorMes };
  }

  /**
   * RF-DES-09: SUBTOTALES mensuales de ventas pagadas.
   *
   * La subconsulta calcula el subtotal de LINEAS por venta (SUM de
   * detalle_ventas.subtotal = base sin IVA) ANTES de agrupar: si se
   * hiciera un JOIN directo, `v.total` se repetiria una vez por linea
   * y el total mensual quedaria multiplicado. Con esto:
   *   subtotal (base) + iva = total facturado, por mes.
   *
   * @returns {Promise<object[]>} filas {anio, mes, subtotal, total,
   *          iva, numero_ventas}.
   */
  async ventasSubtotales() {
    return db.ejecutar(
      `SELECT anio,
              mes,
              SUM(subtotal_linea) AS subtotal,
              SUM(total_venta) AS total,
              SUM(total_venta) - SUM(subtotal_linea) AS iva,
              COUNT(id_venta) AS numero_ventas
         FROM (
           SELECT v.id_venta,
                  YEAR(v.fecha_venta) AS anio,
                  MONTH(v.fecha_venta) AS mes,
                  v.total AS total_venta,
                  (SELECT COALESCE(SUM(dv.subtotal), 0)
                     FROM detalle_ventas dv
                    WHERE dv.id_venta = v.id_venta) AS subtotal_linea
             FROM ventas v
            WHERE v.estado = 'pagada'
         ) t
        GROUP BY anio, mes
        ORDER BY anio ASC, mes ASC`
    );
  }

  /**
   * RF-DES-10: comparativo entre eventos tematicos y fiestas privadas
   * (columna `tipo_evento`, C-07).
   *
   * Metricas por tipo:
   *  - numero de eventos;
   *  - asistencia: ingresos VALIDOS del mismo dia que el evento. Es
   *    una APROXIMACION deliberada: `ingresos` no tiene FK al evento
   *    (el esquema no lo previo), asi que se cuentan las entradas de
   *    la fecha del evento como su publico.
   *
   * @returns {Promise<object[]>} filas {tipo_evento, numero_eventos,
   *          asistencia_total}; solo aparecen los tipos con eventos.
   */
  async comparativoEventos() {
    return db.ejecutar(
      `SELECT e.tipo_evento,
              COUNT(*) AS numero_eventos,
              COALESCE(SUM(
                (SELECT COUNT(*)
                   FROM ingresos i
                  WHERE i.estado = 'valido'
                    AND i.fecha = e.fecha)
              ), 0) AS asistencia_total
         FROM evento e
        GROUP BY e.tipo_evento`
    );
  }
}

// Singleton.
module.exports = new ReporteRepository();
