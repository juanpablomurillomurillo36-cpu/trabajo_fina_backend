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

module.exports = {
  Rol,
  Permiso,
  Usuario,
  Acceso
};
