/**
 * src/middleware/autorizacion.js
 * ---------------------------------------------------------------------
 * MIDDLEWARE DE AUTORIZACION: "¿que puedes hacer?".
 *
 * Se usa SIEMPRE detras de requiereAutenticacion (necesita req.usuario):
 *
 *   router.post('/ventas',
 *     requiereAutenticacion,
 *     requierePermiso('ventas.registrar'),
 *     controlador.crear);
 *
 * DOS HERRAMIENTAS, DOS CASOS DE USO
 * ---------------------------------------------------------------------
 *   requiereRol('admin')            -> regla SIMPLE por nombre de rol.
 *                                      Sin consulta extra: el rol ya
 *                                      esta en req.usuario; solo se
 *                                      verifica que siga ACTIVO.
 *
 *   requierePermiso('compras.crear') -> regla GRANULAR por permiso.
 *                                      Consulta la base (rol_permiso
 *                                      + permisos): es la que permite
 *                                      "al barman solo ventas" sin
 *                                      inventar un rol nuevo.
 *
 * POR QUE 403 Y NO 401?
 *   401 = "no se quien eres" (falta o falla el token).
 *   403 = "se quien eres, pero no puedes" (token valido, rol/permiso
 *         insuficiente). Son problemas distintos y Postman los
 *         distingue al probar.
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const autorizacionRepository = require('../repositories/AutorizacionRepository');
const { capturarAsync } = require('./errorHandler');

/**
 * Comprueba rapido que exista req.usuario (defensa contra rutas mal
 * montadas: si alguien olvida requiereAutenticacion, en vez de un 500
 * criso se lanza un error claro).
 *
 * @param {object} req
 */
function exigirUsuario(req) {
  if (!req.usuario) {
    // 500 a proposito: es un error del DESARROLLADOR, no del cliente.
    throw AppError.interno(
      'La ruta protegida no ejecuto requiereAutenticacion antes de la autorizacion.'
    );
  }
}

/**
 * Exige que el usuario tenga UNO de los roles indicados (por nombre).
 *
 *   requiereRol('admin')
 *   requiereRol('admin', 'gerente')   -> pasa si tiene cualquiera de los dos.
 *
 * @param {...string} nombresRol
 * @returns {function} Middleware de Express
 */
function requiereRol(...nombresRol) {
  return capturarAsync(async (req, res, next) => {
    exigirUsuario(req);

    // Se comprueba uno a uno hasta encontrar coincidencia. Con pocos
    // roles el costo es minimo y el orden permite mensajes futuros
    // mas especificos si hiciera falta.
    for (const nombre of nombresRol) {
      const coincide = await autorizacionRepository.rolActivoTieneNombre(
        req.usuario.idRol,
        nombre
      );

      if (coincide) {
        return next();
      }
    }

    throw AppError.sinPermiso(MENSAJES.NEGOCIO.SIN_PERMISO);
  });
}

/**
 * Exige que el usuario tenga UN permiso especifico (por nombre).
 *
 *   requierePermiso('ventas.anular')
 *
 * La consulta de AutorizacionRepository exige ademas que usuario,
 * rol y permiso esten ACTIVOS: revocar cualquiera de los tres corta
 * el acceso sin tocar tokens.
 *
 * @param {string} nombrePermiso
 * @returns {function} Middleware de Express
 */
function requierePermiso(nombrePermiso) {
  return capturarAsync(async (req, res, next) => {
    exigirUsuario(req);

    const tiene = await autorizacionRepository.tienePermiso(
      req.usuario.id,
      nombrePermiso
    );

    if (!tiene) {
      throw AppError.sinPermiso(MENSAJES.NEGOCIO.SIN_PERMISO);
    }

    return next();
  });
}

module.exports = { requiereRol, requierePermiso };
