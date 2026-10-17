/**
 * src/controllers/auth.controller.js
 * ---------------------------------------------------------------------
 * CAPA DE CONTROLADOR de autenticacion (login, logout, registro,
 * mi perfil).
 *
 * Traduce HTTP <-> AuthService. Cero SQL, cero reglas: si aqui
 * apareciera un `if` de negocio, estaria roto el diseño por capas (C3).
 *
 * Los errores salen solos: capturarAsync deriva cualquier throw al
 * manejador central. AQUI NO HAY try/catch.
 *
 * TABLA DE ENDPOINTS (tambien esta en routes/auth.routes.js)
 *   POST  /api/auth/login             Iniciar sesion (devuelve token)
 *   POST  /api/auth/logout            Cerrar sesion (registra en bitacora)
 *   POST  /api/auth/registro          Registro PUBLICO (rol cliente)
 *   POST  /api/auth/recuperar-password  Paso 1: emite codigo (publico)
 *   POST  /api/auth/restablecer-password Paso 2: codigo -> clave nueva
 *   GET   /api/auth/mi-perfil         Datos propios (requiere token)
 *   PUT   /api/auth/mi-perfil         Editar datos propios (requiere token)
 */

const authService = require('../services/auth.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const { capturarAsync } = require('../middleware/errorHandler');

class AuthController {
  /** POST /api/auth/login */
  login = capturarAsync(async (req, res) => {
    const resultado = await authService.login(req.body, req.ip);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Inicio de sesion'),
      datos: resultado
    });
  });

  /** POST /api/auth/logout  (exige token valido) */
  logout = capturarAsync(async (req, res) => {
    const resultado = await authService.logout(req.usuario.id, req.ip);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cierre de sesion'),
      datos: resultado
    });
  });

  /** POST /api/auth/registro -> 201 + Location del usuario creado */
  registro = capturarAsync(async (req, res) => {
    const resultado = await authService.registro(req.body, req.ip);

    // El recurso nacido es el USUARIO: su URL de lectura es
    // /api/usuarios/:id (aunque para seguirla se necesite token).
    res.set('Location', `/api/usuarios/${resultado.usuario.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Usuario'),
      datos: resultado
    });
  });

  /** POST /api/auth/recuperar-password  (paso 1, siempre 200) */
  recuperarPassword = capturarAsync(async (req, res) => {
    const resultado = await authService.recuperarPassword(req.body, req.ip);

    // 200 a proposito exista o no el correo: una respuesta distinta
    // delataria quienes tienen cuenta (enumeracion de cuentas).
    return respuesta.exito(res, {
      mensaje: resultado.mensaje,
      datos: resultado
    });
  });

  /** POST /api/auth/restablecer-password  (paso 2: codigo + clave nueva) */
  restablecerPassword = capturarAsync(async (req, res) => {
    const resultado = await authService.restablecerPassword(req.body, req.ip);

    return respuesta.exito(res, {
      mensaje: resultado.mensaje,
      datos: resultado
    });
  });

  /** GET /api/auth/mi-perfil */
  miPerfil = capturarAsync(async (req, res) => {
    const usuario = await authService.obtenerMiPerfil(req.usuario.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Usuario'),
      datos: usuario
    });
  });

  /** PUT /api/auth/mi-perfil */
  editarMiPerfil = capturarAsync(async (req, res) => {
    const usuario = await authService.editarMiPerfil(req.usuario.id, req.body, req.ip);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Usuario'),
      datos: usuario
    });
  });
}

// SINGLETON
module.exports = new AuthController();
