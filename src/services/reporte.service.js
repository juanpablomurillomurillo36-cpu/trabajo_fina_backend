/**
 * src/services/reporte.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de los reportes (RF-DES-01..10):
 *  - todos exigen permiso reportes.consultar (lo aplica la ruta).
 *  - el tipo de top de clientes es vip | general -> 400.
 *  - el ranking es por GASTO en ventas pagadas (decision de la fase 45).
 *  - los importes se devuelven redondeados a 2 decimales.
 *  Sin try/catch (R-ASYNC).
 */

const reporteRepository = require('../repositories/ReporteRepository');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');

const TIPOS_TOP = ['vip', 'general'];
// RF-DES-01 / RF-DES-02: el ranking es SIEMPRE Top 10.
const LIMITE_TOP = 10;
// RF-DES-03 / RF-DES-04: mas y menos solicitados, 10 por lista.
const LIMITE_SERVICIOS = 10;

// Nombres de meses para los reportes que muestran "mes de mayor venta"
// y subtotales (en espanol, igual que el resto de la API).
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/** {anio, mes} numericos -> 'agosto de 2026' (para exponer legible). */
function aNombreMes(anio, mes) {
  return `${MESES[Number(mes) - 1] ?? mes} de ${anio}`;
}

/**
 * Fila de servicio -> respuesta camelCase (compartida por las dos
 * listas del reporte de servicios).
 */
function aServicio(fila, posicion) {
  return {
    posicion,
    idServicio: Number(fila.id_servicio),
    nombre: fila.nombre,
    precio: formato.redondearDosDecimales(Number(fila.precio)),
    estado: fila.estado,
    unidadesSolicitadas: Number(fila.unidades_solicitadas),
    numeroReservas: Number(fila.numero_reservas)
  };
}

class ReporteService {
  /**
   * Top 10 de clientes VIP o generales (RF-DES-01 / RF-DES-02).
   *
   * @param {string} tipo  'vip' | 'general'
   * @returns {Promise<object>} ranking ya formateado.
   */
  async topClientes(tipo) {
    const colector = new ColectorErrores();
    colector.exigirValorDeLista('tipo', tipo, TIPOS_TOP);
    colector.lanzarSiHay();

    const filas = await reporteRepository.topClientes({
      vip: tipo === 'vip',
      limite: LIMITE_TOP
    });

    return {
      tipo,
      limite: LIMITE_TOP,
      clientes: filas.map((fila, indice) => ({
        posicion: indice + 1,
        idCliente: Number(fila.id_cliente),
        nombre: fila.nombre,
        apellido: fila.apellido,
        nombreCompleto: `${fila.nombre} ${fila.apellido}`.trim(),
        documento: fila.documento,
        email: fila.email,
        esVip: Boolean(fila.es_vip),
        numeroVentas: Number(fila.numero_ventas),
        gastoTotal: formato.redondearDosDecimales(Number(fila.gasto_total))
      }))
    };
  }

  /**
   * RF-DES-03 / RF-DES-04: servicios mas y menos solicitados.
   * Las dos listas vienen del MISMO reporte (mismo orden base,
   * direcciones opuestas) para que el panel pueda mostrarlas juntas.
   *
   * @returns {Promise<object>} {masSolicitados, menosSolicitados}.
   */
  async serviciosSolicitados() {
    const [mas, menos] = await Promise.all([
      reporteRepository.serviciosSolicitados({ limite: LIMITE_SERVICIOS }),
      reporteRepository.serviciosMenosSolicitados({ limite: LIMITE_SERVICIOS })
    ]);

    return {
      limite: LIMITE_SERVICIOS,
      masSolicitados: mas.map((fila, i) => aServicio(fila, i + 1)),
      menosSolicitados: menos.map((fila, i) => aServicio(fila, i + 1))
    };
  }

  /**
   * RF-DES-05: Top 3 de productos menos vendidos (unidades).
   *
   * @returns {Promise<object>} {productos:[3]}.
   */
  async productosMenosVendidos() {
    const filas = await reporteRepository.productosMenosVendidos();

    return {
      limite: 3,
      productos: filas.map((fila, indice) => ({
        posicion: indice + 1,
        idProducto: Number(fila.id_producto),
        nombre: fila.nombre,
        precioVenta: formato.redondearDosDecimales(Number(fila.precio_venta)),
        stockActual: Number(fila.stock_actual),
        estado: fila.estado,
        unidadesVendidas: Number(fila.unidades_vendidas)
      }))
    };
  }

  /**
   * RF-DES-06: serie de ventas pagadas mes a mes.
   * `anio` es opcional; si viene escrito y no es un entero valido se
   * rechaza con 400 (no se ignora en silencio).
   *
   * @param {object} filtros  ?anio=
   * @returns {Promise<object>} {anio|null, ventas:[...]}.
   */
  async ventasPorMes(filtros = {}) {
    const colector = new ColectorErrores();
    let anio = null;

    if (filtros.anio !== undefined && filtros.anio !== '') {
      anio = formato.aEnteroONulo(filtros.anio);
      if (anio === null || anio < 2000 || anio > 2100) {
        colector.agregar('anio', 'Debe ser un anio valido entre 2000 y 2100');
      }
    }
    colector.lanzarSiHay();

    const filas = await reporteRepository.ventasPorMes(anio);

    return {
      anio,
      ventas: filas.map((fila) => ({
        anio: Number(fila.anio),
        mes: Number(fila.mes),
        mesNombre: aNombreMes(fila.anio, fila.mes),
        periodo: `${fila.anio}-${String(fila.mes).padStart(2, '0')}`,
        total: formato.redondearDosDecimales(Number(fila.total)),
        numeroVentas: Number(fila.numero_ventas)
      }))
    };
  }

  /**
   * RF-DES-07 / RF-DES-08: dia y mes de mayor y menor venta.
   * Si no hay ventas pagadas los cuatro bloques vienen en null.
   *
   * @returns {Promise<object>}
   */
  async mayorMenorVentas() {
    const { mayorDia, menorDia, mayorMes, menorMes } =
      await reporteRepository.mayorMenorVentas();

    const aDia = (fila) =>
      fila === null || fila === undefined
        ? null
        : {
            fecha: formato.aFechaISO(fila.fecha)?.slice(0, 10) ?? fila.fecha,
            total: formato.redondearDosDecimales(Number(fila.total)),
            numeroVentas: Number(fila.numero_ventas)
          };

    const aMes = (fila) =>
      fila === null || fila === undefined
        ? null
        : {
            anio: Number(fila.anio),
            mes: Number(fila.mes),
            mesNombre: aNombreMes(fila.anio, fila.mes),
            periodo: `${fila.anio}-${String(fila.mes).padStart(2, '0')}`,
            total: formato.redondearDosDecimales(Number(fila.total)),
            numeroVentas: Number(fila.numero_ventas)
          };

    return {
      mayorDia: aDia(mayorDia),
      menorDia: aDia(menorDia),
      mayorMes: aMes(mayorMes),
      menorMes: aMes(menorMes)
    };
  }

  /**
   * RF-DES-09: subtotales mensuales (base sin IVA) + IVA + total.
   * Incluye el subtotal GENERAL de todas las ventas pagadas.
   *
   * @returns {Promise<object>} {subtotales:[...], subtotalGeneral:{...}}.
   */
  async ventasSubtotales() {
    const filas = await reporteRepository.ventasSubtotales();

    let acumuladoSubtotal = 0;
    let acumuladoTotal = 0;
    let acumuladoVentas = 0;

    const subtotales = filas.map((fila) => {
      const subtotal = Number(fila.subtotal);
      const total = Number(fila.total);
      acumuladoSubtotal += subtotal;
      acumuladoTotal += total;
      acumuladoVentas += Number(fila.numero_ventas);

      return {
        anio: Number(fila.anio),
        mes: Number(fila.mes),
        mesNombre: aNombreMes(fila.anio, fila.mes),
        periodo: `${fila.anio}-${String(fila.mes).padStart(2, '0')}`,
        subtotal: formato.redondearDosDecimales(subtotal),
        iva: formato.redondearDosDecimales(Number(fila.iva)),
        total: formato.redondearDosDecimales(total),
        numeroVentas: Number(fila.numero_ventas)
      };
    });

    return {
      subtotales,
      subtotalGeneral: {
        subtotal: formato.redondearDosDecimales(acumuladoSubtotal),
        iva: formato.redondearDosDecimales(acumuladoTotal - acumuladoSubtotal),
        total: formato.redondearDosDecimales(acumuladoTotal),
        numeroVentas: acumuladoVentas
      }
    };
  }
}

// Singleton.
module.exports = new ReporteService();
