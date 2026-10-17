/**
 * src/models/index.js
 * ---------------------------------------------------------------------
 * "Barrel file" (archivo barril): reexporta todos los modelos desde un
 * solo punto de entrada.
 *
 * Sin el, cada service necesitaria varias lineas de require:
 *   const Rol     = require('../models/Rol');
 *   const Permiso = require('../models/Permiso');
 *
 * Con el, basta una:
 *   const { Rol, Permiso } = require('../models');
 *
 * NOTA: require('../models') encuentra este archivo solo porque se
 * llama index.js. Es la convencion de Node.js para el archivo
 * principal de una carpeta.
 *
 * REGLA: cada modelo que se cree en las fases siguientes se agrega
 * aqui. Es el unico lugar que cambia al sumar una entidad.
 */

const Rol = require('./Rol');
const Permiso = require('./Permiso');
const Usuario = require('./Usuario');
const Acceso = require('./Acceso');
const Bitacora = require('./Bitacora');
const Proveedor = require('./Proveedor');
const Producto = require('./Producto');
const Servicio = require('./Servicio');
const CategoriaEmpleado = require('./CategoriaEmpleado');
const CategoriaCliente = require('./CategoriaCliente');
const Empleado = require('./Empleado');
const Cliente = require('./Cliente');
const Compra = require('./Compra');
const DetalleCompra = require('./DetalleCompra');
const AgendaEmpleado = require('./AgendaEmpleado');
const Reserva = require('./Reserva');
const DetalleReserva = require('./DetalleReserva');
const Ingreso = require('./Ingreso');

module.exports = {
  Rol,
  Permiso,
  Usuario,
  Acceso,
  Bitacora,
  Proveedor,
  Producto,
  Servicio,
  CategoriaEmpleado,
  CategoriaCliente,
  Empleado,
  Cliente,
  Compra,
  DetalleCompra,
  AgendaEmpleado,
  Reserva,
  DetalleReserva,
  Ingreso
};
