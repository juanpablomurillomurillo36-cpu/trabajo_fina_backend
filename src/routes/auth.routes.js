/**
 * src/routes/auth.routes.js
 * ---------------------------------------------------------------------
 * CAPA DE RUTAS de autenticacion: declara el CONTRATO HTTP.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * POST  /api/auth/login       Iniciar sesion (email + contrasena)
 * POST  /api/auth/logout      Cerrar sesion (registra en bitacora)
 * POST  /api/auth/registro    Registro PUBLICO (rol cliente por defecto)
 * GET   /api/auth/mi-perfil   Datos del usuario autenticado
 * PUT   /api/auth/mi-perfil   Editar nombre/apellido/email/telefono
 * ---------------------------------------------------------------------
 *
 * CUALES ESTAN PROTEGIDAS?
 *   login y registro son PUBLICOS (no tiene sentido exigir token para
 *   obtener uno). Las demas pasan por `requiereAutenticacion`, que
 *   verifica el JWT y popula req.usuario con los datos del dueño.
 */

const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { exigirCuerpo } = require('../middleware/validarParametros');

const router = Router();

// ---- Publicas ----
router.post('/login', exigirCuerpo, authController.login);
router.post('/registro', exigirCuerpo, authController.registro);

// ---- Protegidas (token valido obligatorio) ----
router.post('/logout', requiereAutenticacion, authController.logout);
router.get('/mi-perfil', requiereAutenticacion, authController.miPerfil);
router.put('/mi-perfil', requiereAutenticacion, exigirCuerpo, authController.editarMiPerfil);

module.exports = router;
