/**
 * src/models/Notificacion.js
 * ---------------------------------------------------------------------
 * ENTIDAD Notificacion -> tabla `notificaciones` (RN-12 SIMULADA:
 * no se envia email/sms real; se persiste la fila y se deja el aviso
 * en el log del servidor).
 */

const { TIPO_NOTIFICACION, CANAL_NOTIFICACION, ESTADO_NOTIFICACION } = require('../utils/constants');

class Notificacion {
  #idNotificacion;
  #idCliente;
  #tipo;
  #canal;
  #mensaje;
  #fechaEnvio;
  #estado;
  #nombreCliente;

  constructor(
    id = null,
    idCliente = null,
    tipo = TIPO_NOTIFICACION.PROMOCION,
    canal = CANAL_NOTIFICACION.EMAIL,
    mensaje = null,
    fechaEnvio = null,
    estado = ESTADO_NOTIFICACION.PENDIENTE
  ) {
    this.#idNotificacion = id;
    this.#idCliente = idCliente;
    this.#tipo = tipo;
    this.#canal = canal;
    this.#mensaje = mensaje;
    this.#fechaEnvio = fechaEnvio;
    this.#estado = estado;
    this.#nombreCliente = null;
  }

  get id() {
    return this.#idNotificacion;
  }

  get idCliente() {
    return this.#idCliente;
  }

  get tipo() {
    return this.#tipo;
  }

  get canal() {
    return this.#canal;
  }

  get mensaje() {
    return this.#mensaje;
  }

  get fechaEnvio() {
    return this.#fechaEnvio;
  }

  get estado() {
    return this.#estado;
  }

  get nombreCliente() {
    return this.#nombreCliente;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const notificacion = new Notificacion(
      fila.id_notificacion,
      fila.id_cliente,
      fila.tipo,
      fila.canal,
      fila.mensaje,
      fila.fecha_envio,
      fila.estado
    );

    if (fila.nombre_cliente !== undefined) {
      notificacion.#nombreCliente = fila.nombre_cliente;
    }

    return notificacion;
  }

  /** Fila para INSERT (la simulacion pone estado y fecha_envio). */
  aFilaInsercion() {
    return {
      id_cliente: this.#idCliente,
      tipo: this.#tipo,
      canal: this.#canal,
      mensaje: this.#mensaje,
      fecha_envio: this.#fechaEnvio,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idNotificacion,
      idCliente: this.#idCliente,
      nombreCliente: this.#nombreCliente,
      tipo: this.#tipo,
      canal: this.#canal,
      mensaje: this.#mensaje,
      fechaEnvio: this.#fechaEnvio,
      estado: this.#estado
    };
  }
}

module.exports = Notificacion;
