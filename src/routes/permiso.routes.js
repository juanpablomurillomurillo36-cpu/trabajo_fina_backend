/**
 * src/routes/permiso.routes.js
 * ---------------------------------------------------------------------
 * CAPA DE RUTAS de la entidad Permiso.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * GET    /api/permisos                 Listado con filtros y paginacion
 * POST   /api/permisos                 Crear (201 + Location)
 * GET    /api/permisos/:id             Detalle
 * PUT    /api/permisos/:id             Actualizar (parcial)
 * PATCH  /api/permisos/:id/estado      Cambiar estado
 * DELETE /api/permisos/:id             Eliminar
 * ---------------------------------------------------------------------
 *
 * Sin autenticacion en esta fase (se agregara en la fase de JWT).
 */

const express = require('express');

const permisoController = require('../controllers/permiso.controller');
const { validarIdNumerico, exigirCuerpo } = require('../middleware/validarParametros');

const router = express.Router();

// ---------------------------------------------------------------------
// Coleccion: /api/permisos
// ---------------------------------------------------------------------

// GET /api/permisos
router.get('/', permisoController.listar);

// POST /api/permisos
router.post('/', exigirCuerpo, permisoController.crear);

// ---------------------------------------------------------------------
// Recurso individual: /api/permisos/:id
// ---------------------------------------------------------------------

// GET /api/permisos/:id
router.get('/:id', validarIdNumerico('id'), permisoController.obtener);

// PUT /api/permisos/:id
router.put('/:id', validarIdNumerico('id'), exigirCuerpo, permisoController.actualizar);

// PATCH /api/permisos/:id/estado
router.patch(
  '/:id/estado',
  validarIdNumerico('id'),
  exigirCuerpo,
  permisoController.cambiarEstado
);

// DELETE /api/permisos/:id
router.delete('/:id', validarIdNumerico('id'), permisoController.eliminar);

module.exports = router;
