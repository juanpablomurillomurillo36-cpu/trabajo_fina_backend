/**
 * src/services/programa-puntos.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO del programa de puntos (RN-11):
 *  - 1 punto por cada $10 gastados (floor).
 *  - canje limitado al 50 % de lo acumulado.
 *  - saldo = acumulados - canjeados.
 *
 * `acumular` lo invoca venta.service.pagar despues de su transaccion.
 * Sin try/catch (R-ASYNC).
 */

const clienteRepository = require('../repositories/ClienteRepository');
const programaPuntoRepository = require('../repositories/ProgramaPuntoRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { PUNTOS } = require('../utils/constants');

class ProgramaPuntosService {
  /** Saldo y tope de canje del cliente. */
  async saldo(idCliente) {
    const cliente = await clienteRepository.obtenerPorId(idCliente);
    if (cliente === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('cliente'));
    }

    const programa = await programaPuntoRepository.obtenerPorCliente(idCliente);
    return { ...programa.toJSON(), idCliente };
  }

  /**
   * Suma puntos ganados por un pago. Se omite si el pago no alcanza
   * ni $10 (floor = 0) para no dejar filas sin movimientos.
   *
   * @param {number} idCliente
   * @param {number} totalPagado
   * @returns {Promise<ProgramaPunto|null>}
   */
  async acumular(idCliente, totalPagado) {
    const puntos = Math.floor(totalPagado / PUNTOS.GASTO_POR_PUNTO);

    if (puntos <= 0) {
      return null;
    }

    return programaPuntoRepository.acumular(idCliente, puntos);
  }

  /**
   * Canjea puntos: `cantidad` debe existir en saldo y caber dentro del
   * 50 % vitalicio de canje.
   *
   * @param {number} idCliente
   * @param {number} cantidad
   * @returns {Promise<object>} programa actualizado.
   */
  async canjear(idCliente, cantidad) {
    const colector = new ColectorErrores();
    colector.exigirEntero('cantidad', cantidad, {
      requerido: true,
      minimo: 1,
      maximo: 2147483647 // maximo int de MySQL; el tope real lo pone el 50 %
    });
    colector.lanzarSiHay();

    const cliente = await clienteRepository.obtenerPorId(idCliente);
    if (cliente === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('cliente'));
    }

    const programa = await programaPuntoRepository.obtenerPorCliente(idCliente);

    if (programa.saldo === 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.PUNTOS_NO_CANJEABLES
      );
    }

    if (cantidad > programa.saldo) {
      throw AppError.validacion(
        MENSAJES.NEGOCIO.PUNTOS_INSUFICIENTES(cantidad, programa.saldo)
      );
    }

    if (programa.puntosCanjeados + cantidad > programa.topeCanje) {
      throw AppError.validacion(MENSAJES.NEGOCIO.PUNTOS_NO_CANJEABLES);
    }

    const actualizado = await programaPuntoRepository.canjear(idCliente, cantidad);
    return actualizado.toJSON();
  }
}

// Singleton.
module.exports = new ProgramaPuntosService();
