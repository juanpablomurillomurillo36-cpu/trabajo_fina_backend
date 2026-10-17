/**
 * src/middleware/autenticacion.js
 * ---------------------------------------------------------------------
 * MIDDLEWARE DE AUTENTICACION: "¿quien eres?".
 *
 * Se coloca ANTES de los controladores protegidos:
 *
 *   router.get('/mi-perfil', requiereAutenticacion, controlador.perfil);
 *
 * DOS PASOS, DOS RAZONES
 * ---------------------------------------------------------------------
 *   1. Verificar el JWT (firma, expiracion). Si falla -> 401.
 *      Esto responde "no traes credencial valida".
 *
 *   2. Recargar el usuario de la BASE DE DATOS. Esto parece redundante
 *      ("el token ya trae el id, ¿para que buscarlo?") y NO lo es:
 *      el JWT es una credencial AUTONOMA que no se puede revocar
 *      apenas se emite. Sin este paso, un usuario DADO DE BAJA o
 *      BORRADO seguira teniendo acceso hasta que su token expire
 *      (por defecto 2 horas). Con la consulta, la baja es INMEDIATA:
 *      el proximo request 401/403 sin esperar a nada.
 *
 *      Coste: UNA consulta por peticion protegida. Para esta app
 *      (decenas de usuarios, no millones de requests) es
 *      despreciable frente al beneficio de seguridad.
 *
 * QUE SE ADJUNTA A LA REQUEST
 *   req.usuario = { id, idRol, nombre, email, nombreRol, ... }
 *   Serializado con toJSON(), que POR DISENO excluye contrasena_hash.
 *   El hash nunca debe viajar por req ni por la red.
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const tokens = require('../utils/tokens');
const usuarioRepository = require('../repositories/UsuarioRepository');
const { capturarAsync } = require('./errorHandler');

/**
 * Middleware que exige un JWT valido y usuario activo en la base.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
const requiereAutenticacion = capturarAsync(async (req, res, next) => {
  // 1. Sacar el token de la cabecera Authorization.
  //    extraerDeCabecera devuelve null si no hay cabecera; verificar
  //    lanza 401 JWT_FALTANTE en ese caso.
  const token = tokens.extraerDeCabecera(req.headers.authorization);

  // 2. Verificar firma + expiracion. Lanza 401 JWT_INVALIDO si algo falla.
  const payload = tokens.verificar(token);

  // 3. ¿El usuario del token sigue existiendo?
  //    Si fue borrado (no solo desactivado), el token queda "huerfano":
  //    representa a alguien que ya no esta. Se rechaza como invalido.
  const usuario = await usuarioRepository.obtenerPorId(payload.id);

  if (usuario === null) {
    throw AppError.noAutenticado(MENSAJES.NEGOCIO.JWT_INVALIDO);
  }

  // 4. ¿Sigue activo? Baja logica = corte de acceso inmediato.
  if (!usuario.estaActivo()) {
    throw AppError.sinPermiso(MENSAJES.NEGOCIO.USUARIO_INACTIVO);
  }

  // 5. Adjuntar el usuario SIN el hash (toJSON lo excluye por diseño).
  //    Los middlewares siguientes y los services lo leen de aqui.
  req.usuario = usuario.toJSON();

  return next();
});

module.exports = { requiereAutenticacion };
