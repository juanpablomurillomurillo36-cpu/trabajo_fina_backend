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
 * RECUPERACION de contrasena NO viven aqui: van en /api/acceso
 * (fase 20-21), porque son operaciones de SESION, no del CRUD.
 */

const { Router } = require('express');

const usuarioController = require('../controllers/usuario.controller');
const { validarIdNumerico, exigirCuerpo } = require('../middleware/validarParametros');

const router = Router();

// ---- Coleccion: /api/usuarios ----
router.get('/', usuarioController.listar);
router.post('/', exigirCuerpo, usuarioController.crear);

// ---- Recurso individual: /api/usuarios/:id ----
router.get('/:id', validarIdNumerico('id'), usuarioController.obtener);
router.put('/:id', validarIdNumerico('id'), exigirCuerpo, usuarioController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), exigirCuerpo, usuarioController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), usuarioController.eliminar);

module.exports = router;
