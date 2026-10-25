/**
 * src/routes/usuario.routes.js
 * ---------------------------------------------------------------------
 * CAPA DE RUTAS de la entidad Usuario.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * GET    /api/usuarios                  Listado con filtros y paginacion
 * POST   /api/usuarios                  Crear (201 + Location)
 * GET    /api/usuarios/:id              Detalle
 * PUT    /api/usuarios/:id              Actualizar (parcial)
 * PATCH  /api/usuarios/:id/estado       Cambiar estado
 * DELETE /api/usuarios/:id              Eliminar
 * ---------------------------------------------------------------------
 *
 * Sin autenticacion en esta fase. Cuando entre el JWT, el middleware
 * de sesion se registra AQUI, delante de los controladores, para que
 * ninguna de estas rutas se pueda tocar sin token.
 */

const express = require('express');

const usuarioController = require('../controllers/usuario.controller');
const { validarIdNumerico, exigirCuerpo } = require('../middleware/validarParametros');

const router = express.Router();

// ---------------------------------------------------------------------
// Coleccion: /api/usuarios
// ---------------------------------------------------------------------

// GET /api/usuarios
router.get('/', usuarioController.listar);

// POST /api/usuarios
router.post('/', exigirCuerpo, usuarioController.crear);

// ---------------------------------------------------------------------
// Recurso individual: /api/usuarios/:id
// ---------------------------------------------------------------------

// GET /api/usuarios/:id
router.get('/:id', validarIdNumerico('id'), usuarioController.obtener);

// PUT /api/usuarios/:id
router.put('/:id', validarIdNumerico('id'), exigirCuerpo, usuarioController.actualizar);

// PATCH /api/usuarios/:id/estado
router.patch(
  '/:id/estado',
  validarIdNumerico('id'),
  exigirCuerpo,
  usuarioController.cambiarEstado
);

// DELETE /api/usuarios/:id
router.delete('/:id', validarIdNumerico('id'), usuarioController.eliminar);

module.exports = router;
