/**
 * src/models/ProgramaPunto.js
 * ---------------------------------------------------------------------
 * Modelo de `programa_puntos` — programa de fidelizacion (RN-11):
 *  - 1 punto por cada $10 gastados (PUNTOS.GASTO_POR_PUNTO);
 *  - el cliente puede canjear como maximo el 50 % de lo acumulado
 *    (PUNTOS.PORCENTAJE_CANJE) => el excedente jamas se canjea.
 *
 * saldo = puntos_acumulados - puntos_canjeados.
 * NOTA: `id_cliente` solo es KEY (sin unique), por eso el repo hace
 * "buscar o insertar" con transaccion.
 */

const { aFechaISO } = require('../utils/fechas');

class ProgramaPunto {
  #id;
  #idCliente;
  #puntosAcumulados;
  #puntosCanjeados;
  #fechaActualizacion;

  constructor(
    id = null,
    idCliente = null,
    puntosAcumulados = 0,
    puntosCanjeados = 0,
    fechaActualizacion = null
  ) {
    this.#id = id === null || id === undefined ? null : Number(id);
    this.#idCliente = idCliente === null || idCliente === undefined ? null : Number(idCliente);
    this.#puntosAcumulados = Number(puntosAcumulados) || 0;
    this.#puntosCanjeados = Number(puntosCanjeados) || 0;
    this.#fechaActualizacion = fechaActualizacion ?? null;
  }

  get id() { return this.#id; }
  get idCliente() { return this.#idCliente; }
  get puntosAcumulados() { return this.#puntosAcumulados; }
  get puntosCanjeados() { return this.#puntosCanjeados; }
  get fechaActualizacion() { return this.#fechaActualizacion; }

  /** Saldo disponible = acumulado - canjeado. */
  get saldo() {
    return this.#puntosAcumulados - this.#puntosCanjeados;
  }

  /** Tope vitalicio de canje: 50 % de lo acumulado. */
  get topeCanje() {
    return Math.floor((this.#puntosAcumulados * 50) / 100);
  }

  /** Cuantos puntos podria canjear HOY (dentro del 50 %). */
  get canjeables() {
    return Math.max(0, this.topeCanje - this.#puntosCanjeados);
  }

  /** Fila -> modelo. */
  static desdeFila(fila) {
    if (!fila) return null;
    return new ProgramaPunto(
      fila.id_programa_puntos,
      fila.id_cliente,
      fila.puntos_acumulados,
      fila.puntos_canjeados,
      fila.fecha_actualizacion
    );
  }

  /** Respuesta JSON con camelCase + reglas derivadas. */
  toJSON() {
    return {
      id: this.#id,
      idCliente: this.#idCliente,
      puntosAcumulados: this.#puntosAcumulados,
      puntosCanjeados: this.#puntosCanjeados,
      saldo: this.saldo,
      canjeables: this.canjeables,
      fechaActualizacion: aFechaISO(this.#fechaActualizacion)
    };
  }

  /** Fila de INSERT (sin PK ni fecha: las genera MySQL). */
  aFilaInsercion() {
    return {
      id_cliente: this.#idCliente,
      puntos_acumulados: this.#puntosAcumulados,
      puntos_canjeados: this.#puntosCanjeados
    };
  }
}

module.exports = ProgramaPunto;
