/**
 * src/utils/cifrado.js
 * ---------------------------------------------------------------------
 * Hash de contrasenas con bcrypt.
 *
 * REGLA #1 DE SEGURIDAD: JAMAS se guarda una contrasena en claro.
 * Ni en la base, ni en un log, ni en una respuesta de la API. Solo
 * guarda su HASH.
 *
 * QUE ES UN HASH?
 * Una funcion de sentido unico: de "Clave1234" sale
 * "$2b$12$Kix6...." (60 caracteres), pero del hash no se puede volver
 * a la contrasena. Ademas, agregarle "sal" (salt) al hash garantiza
 * que dos personas con la misma contrasena tengan hashes distintos,
 * lo que impide descifrar en bloque con tablas precalculadas.
 *
 * POR QUE bcrypt y no MD5/SHA-256?
 * Porque SHA esta pensado para RAPIDEZ: una tarjeta grafica hace
 * miles de millones de intentos por segundo. bcrypt esta pensado para
 * ser LENTO a proposito (los 12 "rounds" tardan ~250 ms), lo que hace
 * inviable un ataque de fuerza bruta.
 *
 * POR QUE bcryptjs y no bcrypt?
 * bcrypt nativo compila un modulo C con node-gyp, que suele fallar en
 * Windows sin herramientas de compilacion. bcryptjs es javascript
 * puro: instala y funciona en cualquier equipo.
 */

const bcrypt = require('bcryptjs');
const { SEGURIDAD } = require('./constants');

/**
 * Genera el hash de una contrasena.
 *
 * @param {string} contrasena  En claro, tal como la escribio el usuario.
 * @returns {Promise<string>}  El hash de 60 caracteres.
 *
 * @example
 *   const hash = await cifrado.hashearPassword('Clave1234');
 *   // -> "$2b$12$X1y2..."
 */
async function hashearPassword(contrasena) {
  // bcrypt.hash es async: por debajo usa el hilo del pool de Node para
  // no congelar el event loop mientras calcula los 12 round.
  return bcrypt.hash(contrasena, SEGURIDAD.BCRYPT_ROUNDS);
}

/**
 * Compara una contrasena en claro contra un hash guardado.
 *
 * Es la UNICA manera correcta de verificarla. Se usa en el login
 * (fase de autenticacion) y en el restablecimiento de clave.
 *
 * @param {string} contrasena   La que escribio el usuario ahora.
 * @param {string} hash         La que esta en la base de datos.
 * @returns {Promise<boolean>}  true si coinciden.
 *
 * @example
 *   const coincide = await cifrado.verificarPassword('Clave1234', hashGuardado);
 */
async function verificarPassword(contrasena, hash) {
  // Si en la base no hay hash (usuario creado por un camino raro),
  // devolvemos false en vez de dejar que bcrypt explote con null.
  if (typeof hash !== 'string' || hash === '') return false;

  return bcrypt.compare(contrasena, hash);
}

/**
 * Comprueba si un texto ya tiene forma de hash de bcrypt.
 * Sirve para detectar dobles hashes en migraciones de datos.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esHashBcrypt(valor) {
  return typeof valor === 'string' && /^\$2[aby]\$\d{2}\$/.test(valor);
}

module.exports = { hashearPassword, verificarPassword, esHashBcrypt };
