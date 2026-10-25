/**
 * src/config/env.js
 * ---------------------------------------------------------------------
 * Carga y VALIDA las variables de entorno.
 *
 * POR QUE UN MODULO DEDICADO?
 *
 * 1. `require('dotenv').config()` se ejecuta UNA sola vez, aqui.
 *    El resto de la aplicacion importa este modulo en lugar de leer
 *    `process.env` por todos lados. Si cada archivo leyera process.env
 *    directamente, no existiria un unico lugar donde ver "que
 *    configuracion esta usando el servidor".
 *
 * 2. Validamos al ARRANCAR (fail fast). Es mejor que el servidor NO
 *    arranque por falta de DB_CLAVE, que arranque y falle despues con
 *    un error confuso en la primera peticion de un usuario real.
 *
 * 3. Convertimos los TIPOS. `process.env` SIEMPRE devuelve texto:
 *    process.env.PUERTO es "3000" (string), no 3000 (number). Sin
 *    convertir, `app.listen("3000")` funciona por casualidad y
 *    `config.puerto > 1024` da resultados raros.
 *
 * DONDE ESTA EL ARCHIVO .env?
 * En `src/.env`, es decir, UN nivel arriba de este archivo
 * (config/). Por eso la ruta es '../.env' resuelta contra __dirname.
 */

const path = require('node:path');

// dotenv lee el archivo .env y copia su contenido a process.env.
// Indicamos la ruta de forma explicita para que funcione sin importar
// desde que carpeta se ejecute "node src/index.js".
require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env')
});

const MENSAJES = require('../utils/mensajes');

/**
 * Lee una variable OBLIGATORIA. Si no existe, detiene el proceso.
 *
 * @param {string} nombre
 * @returns {string}
 */
function obligatoria(nombre) {
  const valor = process.env[nombre];

  if (valor === undefined || valor === null || String(valor).trim() === '') {
    // console.error escribe en el flujo de errores (stderr), que es
    // donde mira un administrador del sistema; stdout es para datos.
    console.error(`\n[CONFIG] ${MENSAJES.SISTEMA.VARIABLE_ENTORNO_FALTANTE(nombre)}\n`);

    // process.exit(1) termina el programa con codigo de error.
    // El 0 significa "todo bien"; cualquier otro numero, "fallo".
    process.exit(1);
  }

  return String(valor).trim();
}

/**
 * Lee una variable OPCIONAION y devuelve un valor por defecto si falta.
 *
 * @param {string} nombre
 * @param {*} valorPorDefecto
 * @returns {string}
 */
function opcional(nombre, valorPorDefecto) {
  const valor = process.env[nombre];

  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return valorPorDefecto;
  }

  return String(valor).trim();
}

/**
 * Lee una variable y la convierte a numero entero.
 *
 * @param {string} nombre
 * @param {number} valorPorDefecto
 * @returns {number}
 */
function entera(nombre, valorPorDefecto) {
  const texto = opcional(nombre, String(valorPorDefecto));
  const numero = Number.parseInt(texto, 10);

  // Number.isNaN detecta el caso "abc" -> NaN.
  return Number.isNaN(numero) ? valorPorDefecto : numero;
}

/**
 * Lee una variable con valores separados por coma y devuelve un arreglo.
 *   "http://a.com, http://b.com"  ->  ["http://a.com", "http://b.com"]
 *
 * @param {string} nombre
 * @param {string[]} valorPorDefecto
 * @returns {string[]}
 */
function lista(nombre, valorPorDefecto = []) {
  const texto = opcional(nombre, '');

  if (texto === '') return valorPorDefecto;

  return texto
    .split(',')
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0);
}

// ---------------------------------------------------------------------
// Objeto de configuracion final.
// Object.freeze lo vuelve inmutable: ningun modulo puede alterarlo
// despues de que la aplicacion arranco. Si alguien intenta
// `config.puerto = 9999`, en modo estricto lanza TypeError y en modo
// flojo no pasa nada: de cualquier manera el valor NO cambia.
// ---------------------------------------------------------------------
const config = Object.freeze({
  // Entorno de ejecucion: development | production | test
  entorno: opcional('NODE_ENV', 'development'),

  // Puerto donde escucha Express.
  puerto: entera('PUERTO', 3000),

  // Datos de conexion a MySQL.
  baseDatos: Object.freeze({
    host: opcional('DB_HOST', 'localhost'),
    puerto: entera('DB_PUERTO', 3306),
    usuario: obligatoria('DB_USUARIO'),
    clave: obligatoria('DB_CLAVE'),
    nombre: obligatoria('DB_NOMBRE'),
    limiteConexiones: entera('DB_LIMITE_CONEXIONES', 10)
  }),

  // Origenes autorizados para CORS.
  origenesPermitidos: lista('ORIGENES_PERMITIDOS', ['http://localhost:5500']),

  // Atajos booleanos para no comparar textos por toda la aplicacion.
  get esDesarrollo() {
    return this.entorno === 'development';
  },

  get esProduccion() {
    return this.entorno === 'production';
  }
});

module.exports = config;
