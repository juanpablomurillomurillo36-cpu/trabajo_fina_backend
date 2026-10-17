/**
 * src/models/Cliente.js
 * ---------------------------------------------------------------------
 * ENTIDAD Cliente -> tabla `clientes`.
 *
 * Ficha del cliente de la discoteca: categoria, documento UNICO
 * (el plan le llamaba RFC; manda el esquema), fecha de nacimiento y
 * bandera `es_vip` que alimenta los reportes de fidelizacion (RN-11
 * y C1: top de clientes VIP).
 *
 * `#nombreCategoria` viene del JOIN con `categoria_clientes` (solo
 * lectura; jamas entra a aFilaBaseDatos()).
 *
 * POO: P1 privados + getters; P6 factories y toJSON().
 */

const { ESTADO } = require('../utils/constants');

class Cliente {
  #idCliente;
  #idCategoriaCliente;
  #nombre;
  #apellido;
  #documento;
  #telefono;
  #email;
  #fechaNacimiento;
  #esVip;
  #estado;
  #nombreCategoria;

  constructor(
    id = null,
    idCategoriaCliente = null,
    nombre = '',
    apellido = '',
    documento = '',
    telefono = null,
    email = null,
    fechaNacimiento = null,
    esVip = false,
    estado = ESTADO.ACTIVO
  ) {
    this.#idCliente = id;
    this.#idCategoriaCliente = idCategoriaCliente;
    this.#fechaNacimiento = fechaNacimiento;
    this.#estado = estado;
    this.#nombreCategoria = null;

    this.nombre = nombre;
    this.apellido = apellido;
    this.documento = documento;
    this.telefono = telefono;
    this.email = email;
    this.esVip = esVip;
  }

  get id() {
    return this.#idCliente;
  }

  get idCategoriaCliente() {
    return this.#idCategoriaCliente;
  }

  set idCategoriaCliente(valor) {
    this.#idCategoriaCliente = valor;
  }

  get nombre() {
    return this.#nombre;
  }

  set nombre(valor) {
    this.#nombre = typeof valor === 'string' ? valor.trim() : '';
  }

  get apellido() {
    return this.#apellido;
  }

  set apellido(valor) {
    this.#apellido = typeof valor === 'string' ? valor.trim() : '';
  }

  get documento() {
    return this.#documento;
  }

  set documento(valor) {
    const limpio = typeof valor === 'string' ? valor.trim() : '';
    this.#documento = limpio === '' ? '' : limpio;
  }

  get telefono() {
    return this.#telefono;
  }

  set telefono(valor) {
    const limpio = typeof valor === 'string' ? valor.trim() : '';
    this.#telefono = limpio === '' ? null : limpio;
  }

  get email() {
    return this.#email;
  }

  set email(valor) {
    const limpio = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
    this.#email = limpio === '' ? null : limpio;
  }

  get fechaNacimiento() {
    return this.#fechaNacimiento;
  }

  set fechaNacimiento(valor) {
    this.#fechaNacimiento = valor ?? null;
  }

  get esVip() {
    return this.#esVip;
  }

  set esVip(valor) {
    // Acepta true/'true'/1/'1' (tinyint(1) en MySQL); todo lo demas es false.
    this.#esVip = valor === true || valor === 1 || valor === '1' || valor === 'true';
  }

  get estado() {
    return this.#estado;
  }

  set estado(valor) {
    this.#estado = valor;
  }

  get nombreCategoria() {
    return this.#nombreCategoria;
  }

  estaActivo() {
    return this.#estado === ESTADO.ACTIVO;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const cliente = new Cliente(
      fila.id_cliente,
      fila.id_categoria_cliente,
      fila.nombre,
      fila.apellido,
      fila.documento,
      fila.telefono,
      fila.email,
      fila.fecha_nacimiento,
      fila.es_vip,
      fila.estado
    );

    if (fila.nombre_categoria !== undefined) {
      cliente.#nombreCategoria = fila.nombre_categoria;
    }

    return cliente;
  }

  static desdeJSON(datos = {}) {
    return new Cliente(
      datos.id ?? datos.idCliente ?? null,
      datos.idCategoriaCliente ?? null,
      datos.nombre ?? '',
      datos.apellido ?? '',
      datos.documento ?? '',
      datos.telefono ?? null,
      datos.email ?? null,
      datos.fechaNacimiento ?? null,
      datos.esVip ?? false,
      datos.estado ?? ESTADO.ACTIVO
    );
  }

  aFilaBaseDatos() {
    return {
      id_categoria_cliente: this.#idCategoriaCliente,
      nombre: this.#nombre,
      apellido: this.#apellido,
      documento: this.#documento,
      telefono: this.#telefono,
      email: this.#email,
      fecha_nacimiento: this.#fechaNacimiento,
      es_vip: this.#esVip ? 1 : 0,
      estado: this.#estado
    };
  }

  toJSON() {
    return {
      id: this.#idCliente,
      idCategoriaCliente: this.#idCategoriaCliente,
      nombre: this.#nombre,
      apellido: this.#apellido,
      documento: this.#documento,
      telefono: this.#telefono,
      email: this.#email,
      fechaNacimiento: this.#fechaNacimiento,
      esVip: this.#esVip,
      estado: this.#estado,
      activo: this.estaActivo(),
      nombreCategoria: this.#nombreCategoria
    };
  }
}

module.exports = Cliente;
