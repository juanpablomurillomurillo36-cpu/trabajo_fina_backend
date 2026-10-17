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
}

// Singleton.
module.exports = new ReporteService();
