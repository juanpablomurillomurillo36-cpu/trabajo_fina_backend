/**
 * src/utils/tokens.js
 * ---------------------------------------------------------------------
 * Utilidades de TOKENS JWT (JSON Web Token).
 *
 * PARA QUE SIRVE UN JWT EN ESTA API?
 * El protocolo HTTP es SIN ESTADO: cada peticion llega sola y el
 * servidor no recuerda la anterior. Despues del login, el frontend
 * necesita una forma de decir "soy Juan" en CADA peticion sin volver a
 * enviar la contrase\u00f1a. El JWT es esa credencial port\u00e1til:
 *
 *   1. El cliente hace LOGIN (correo + contrase\u00f1a).
 *   2. El servidor FIRMA un token con los datos del usuario.
 *   3. El cliente lo guarda y lo envia en cada peticion:
 *        Authorization: Bearer eyJhbGciOi...
 *   4. El servidor VERIFICA la firma. Si es valida, confia en el
 *      payload; si alguien lo altero, la firma no coincide y se rechaza.
 *
 * POR QUE FIRMA Y NO ENCRIPTA?
 * El payload NO es secreto: el cliente puede abrir el token (esta en
 * base64) y leer su propio contenido. Lo que SI es intocable es la
 * FIRMA (HMAC-SHA256 con el secreto del servidor). Alterar una coma
 * del payload invalida la firma completa.
 *
 * COMO SE VERIFICA?
 *   HMAC-SHA256(payload, JWT_SECRETO) -> se compara con la firma enviada.
 * Solo quien conoce el secreto puede producir una firma valida. Sin
 * secreto robado, un atacante no puede emitir tokens a su medida.
 *
 * RELACION CON LAS CAPAS:
 *   utils/tokens.js     -> "COMO" se firma/verifica (mecanica)
 *   middleware/autenticacion.js -> "DONDE" se verifica (en cada ruta)
 *   services/...        -> "QUE" se guarda en el payload (reglas)
 */

const jwt = require('jsonwebtoken');
const AppError = require('./AppError');
const MENSAJES = require('./mensajes');
const configuracion = require('../config/env');

/**
 * Firma un token JWT con el payload dado.
 *
 * @param {object} payload   Datos que viajan DENTRO del token.
 *                           Debe incluir al menos `id` del usuario.
 * @param {object} [opciones]
 * @param {string} [opciones.expiracion]  Ej. '30m', '2h'. Si no viene,
 *                           se usa JWT_EXPIRACION del .env.
 * @returns {string} El token firmado (texto largo, sin espacios).
 * @throws {AppError} 500 si el payload es invalido.
 */
function firmar(payload, { expiracion } = {}) {
  if (!payload || typeof payload !== 'object' || payload.id === undefined) {
    // Un token sin sujeto identificable no sirve para autorizar nada.
    throw AppError.interno('No se puede firmar un token sin identificacion.');
  }

  return jwt.sign(payload, configuracion.autenticacion.secreto, {
    // expiresIn viene como string legible: jwt lo interpreta.
    expiresIn: expiracion ?? configuracion.autenticacion.expiracion
  });
}

/**
 * Verifica un token y devuelve su payload.
 *
 * SI LA FIRMA ES INVALIDA, EL TOKEN SE RECHAZA. jwt.verify lanza una
 * excepcion propia (TokenExpiredError, JsonWebTokenError...); aqui se
 * traduce TODA esa familia de errores a UN 401 con mensaje claro,
 * porque al cliente solo le importa que el token no sirve.
 *
 * @param {string} token  El token tal cual llega en la cabecera
 *                        Authorization (sin el prefijo "Bearer ").
 * @returns {object} El payload decodificado.
 * @throws {AppError} 401 si no viene, expiro o la firma no coincide.
 */
function verificar(token) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw AppError.noAutenticado(MENSAJES.NEGOCIO.JWT_FALTANTE);
  }

  try {
    return jwt.verify(token, configuracion.autenticacion.secreto);
  } catch {
    // Se oculta el motivo exacto a proposito: decir "token expirado"
    // vs "firma invalida" ayudaria a un atacante a distinguir si
    // robo un token viejo o si esta intentando forjar uno.
    throw AppError.noAutenticado(MENSAJES.NEGOCIO.JWT_INVALIDO);
  }
}

/**
 * Extrae el token de la cabecera Authorization.
 *
 * La forma estandar es "Bearer <token>". Se acepta tambien el token
 * solo, porque muchos clientes de prueba (curl, Postman en modo
 * basico) olvidan el prefijo y un 401 por eso confunde.
 *
 * @param {string|undefined} cabecera  req.headers.authorization
 * @returns {string|null} El token, o null si no hay cabecera.
 */
function extraerDeCabecera(cabecera) {
  if (!cabecera || typeof cabecera !== 'string') return null;

  const partes = cabecera.trim().split(/\s+/);

  // Con prefijo Bearer: "Bearer abc123" -> ["Bearer", "abc123"]
  if (partes.length === 2 && /^bearer$/i.test(partes[0])) {
    return partes[1];
  }

  // Sin prefijo: se asume que todo el valor es el token.
  return partes[0] || null;
}

module.exports = {
  firmar,
  verificar,
  extraerDeCabecera
};
