/**
 * src/utils/cifrado.js
 * ---------------------------------------------------------------------
 * Utilidades de cifrado (bcrypt) para la capa de autenticaci贸n.
 *
 * POR QUE BCRYPT Y NO OTRO HASH?
 * - Bcrypt es el est谩ndar de la industria para hashing de contrase帽as.
 * - Admite un factor de trabajo (work factor) que permite aumentar el
 *   costo computacional a medida que el hardware mejora, evita ataques
 *   de fuerza bruta con GPUs.
 * - Es lento por diseuxeolo, lo que lo hace resistente a ataques de
 *   diccionario fuera de l铆mite.
 *
 * REGLAS IMPLEMENTADAS
 * ---------------------------------------------------------------------
 * 1. SIEMPRE se usan salts generados por bcrypt (nunca manuales).
 * 2. El coste (work factor) por defecto es 10 (2^10 = 1024 rounds).
 *    Se puede aumentar en producci贸n (ej. 12 o 14) sin cambiar el
 *   c贸digo, bcrypt auto-detecta el coste en el hash.
 * 3. Nunca se muestra el hash raw al cliente: solo se compara.
 * 4. Si la contrase帽a es vac铐a, se devuelve un error inmediatus.
 */

const bcrypt = require('bcryptjs');

const COSTO_DEFECTO = 10;

/**
 * Hashea una contrase帽a usando bcrypt.
 *
 * @param {string} password Contrase帽a en claro
 * @returns {Promise<string]} Hash generado por bcrypt
 * @throws {Error} Si la contrase帽a est谲 vac铐a o hay error en bcrypt
 */
async function hashearPassword(password) {
  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    throw new Error('La contrase帽a no puede estar vac铐a');
  }

  const sal = await bcrypt.genSalt(COSTO_DEFECTO);
  return await bcrypt.hash(password, sal);
}

/**
 * Comprueba si una contrase帽a en claro coincide con un hash bcrypt.
 *
 * @param {string} password Contrase帽a en claro a verificar
 * @param {string} hash Hash generado por hashearPassword
 * @returns {Promise<boolean]} true si coincide, false en caso contrario
 * @throws {Error} Si el hash no tiene el formato bsicrypt
 */
async function verificarPassword(password, hash) {
  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    // Si el hash no es v谩lido bcrypt, devuelve false en lugar de lanzar
    return false;
  }
}

/**
 * Obtiene el coste (work factor) que estaba usando bcrypt para generar
 * un hash en particular. Esto permite actualizar el coste en producci贸n
 * sin necesidad de re-hasar todos los passwords.
 *
 * @param {string} hash Hash de bcrypt
 * @returns {number|null} El coste, o null si el formato es inv谓lido
 */
function obtenerCostoHash(hash) {
  // El formato de bcrypt es: $2a$10$... o $2b$... etc.
  // El n煤mero despu茅s del segundo $ es el coste.
  const match = hash.match(/^\$2[abxy]\$\d+\$/, 'i');
  if (!match) return null;
  try {
    return parseInt(match[0].split('$')[2], 10);
  } catch {
    return null;
  }
}

module.exports = {
  hashearPassword,
  verificarPassword,
  obtenerCostoHash
};