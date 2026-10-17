/**
 * src/routes/usuario.routes.js
 * ---------------------------------------------------------------------
 * CAPA DE RUTAS de la entidad Usuario.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * GET    /api/usuarios               Lista (filtros: estado, busqueda, idRol)
 * GET    /api/usuarios/:id           Detalle
 * POST   /api/usuarios               Crear (contrasena en claro -> hash)
 * PUT    /api/usuarios/:id           Actualizar (contrasena opcional)
 * PATCH  /api/usuarios/:id/estado    Activar / desactivar
 * DELETE /api/usuarios/:id           Eliminar (409 con historial)
 * ---------------------------------------------------------------------
 *
 * NOTA DE SEGURIDAD: las rutas de LOGIN, REGISTRO, PERFIL y
 * RECUPERACION de contrasena NO viven aqui: van en /api/auth
 * (fase 20-21), porque son operaciones de SESION, no del CRUD.
 *
 * PROTECCION (fase 22): TODO el CRUD exige token + permiso
 * `usuarios.gestionar`. Gestionar cuentas es la operacion mas
 * sensible del sistema: quien puede crear usuarios puede crear
 * administradores.
 */

const { Router } = require('express');

const usuarioController = require('../controllers/usuario.controller');
const { validarIdNumerico, exigirCuerpo } = require('../middleware/validarParametros');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');

const router = Router();

// Proteccion GLOBAL de la ruta: todo lo que sigue pasa por aqui.
router.use(requiereAutenticacion, requierePermiso('usuarios.gestionar'));

// ---- Coleccion: /api/usuarios ----
router.get('/', usuarioController.listar);
router.post('/', exigirCuerpo, usuarioController.crear);

// ---- Recurso individual: /api/usuarios/:id ----
router.get('/:id', validarIdNumerico('id'), usuarioController.obtener);
router.put('/:id', validarIdNumerico('id'), exigirCuerpo, usuarioController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), exigirCuerpo, usuarioController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), usuarioController.eliminar);

module.exports = router;
