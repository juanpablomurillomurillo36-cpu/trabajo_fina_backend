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
}

// Singleton.
module.exports = new ReporteService();
