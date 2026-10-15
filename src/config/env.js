/**
 * src/config/env.js
 * ---------------------------------------------------------------------
 * Carga y VALIDA las variables de entorno del archivo .env.
 *
 * POR QUE UN MODULO DEDICADO?
 *
 *   1. `require('dotenv').config()` se ejecuta UNA sola vez, aqui.
 *      El resto de la aplicacion importa este modulo en lugar de leer
 *      `process.env` por todos lados. Si cada archivo leyera process.env
 *      directamente, no habria un unico lugar donde ver la configuracion.
 *
 *   2. Validamos al arrancar (patron "fail fast"). Es mejor que el
 *      servidor NO arranque por falta de DB_CLAVE, que arranque y falle
 *      con un error confuso en la primera peticion de un usuario.
 *
 *   3. Convertimos los tipos. `process.env` SIEMPRE devuelve texto:
 *      process.env.PUERTO es "3000" (cadena), no 3000 (numero).
 */

const path = require('node:path');

// dotenv lee el archivo .env y copia su contenido a process.env.
// Indicamos la ruta explicita para que funcione desde cualquier carpeta.
// `quiet: true` silencia el aviso "injected env (...)" que dotenv
// imprime en stderr; esa linea solo ensucia el log del servidor.
require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '.env'),
  quiet: true
});

// ---------------------------------------------------------------------
// Funciones auxiliares de lectura
// ---------------------------------------------------------------------

/**
 * Lee una variable OBLIGATORIA. Si no existe o viene vacia, detiene el
 * proceso con un mensaje claro. Esto es el corazon del "fail fast".
 *
 * @param {string} nombre  Nombre de la variable en el .env
 * @returns {string} El valor recortado de espacios
 */
function obligatoria(nombre) {
  const valor = process.env[nombre];

  if (valor === undefined || valor === null || String(valor).trim() === '') {
    console.error(`\n[CONFIG] Falta la variable de entorno obligatoria: ${nombre}`);
    console.error(`         Copia .env.example a .env y completala.\n`);
    // Codigo de salida distinto de 0 = hubo un fallo.
    process.exit(1);
  }

  return String(valor).trim();
}

/**
 * Lee una variable OPCIONAL. Si falta, devuelve el valor por defecto.
 *
 * @param {string} nombre
 * @param {*}      valorPorDefecto
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
 * Si el texto no es un numero, devuelve el valor por defecto.
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
// Object.freeze lo vuelve INMUTABLE: ningun modulo puede alterarlo
// despues de que la aplicacion arranco.
// ---------------------------------------------------------------------
const configuracion = Object.freeze({
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

  // Origenes autorizados para CORS (el frontend).
  origenesPermitidos: lista('ORIGENES_PERMITIDOS', ['http://localhost:5500']),

  // Autenticacion por token.
  autenticacion: Object.freeze({
    secreto: obligatoria('JWT_SECRETO'),
    expiracion: opcional('JWT_EXPIRACION', '2h')
  }),

  // Reglas de negocio parametrizadas en el .env.
  negocio: Object.freeze({
    aforoMaximo: entera('AFORO_MAXIMO', 200),
    ivaPorcentaje: entera('IVA_PORCENTAJE', 16)
  }),

  // Atajos booleanos para no comparar textos por toda la aplicacion.
  get esDesarrollo() {
    return this.entorno === 'development';
  },

  get esProduccion() {
    return this.entorno === 'production';
  }
});

module.exports = configuracion;
