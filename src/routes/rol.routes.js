/**
 * src/routes/rol.routes.js
 * ---------------------------------------------------------------------
 * CAPA DE RUTAS de la entidad Rol: declara el CONTRATO HTTP.
 *
 * Los middlewares de validacion van ANTES del controlador:
 *   - validarIdNumerico('id') -> si el id no es numero, responde 400
 *     sin llegar a la capa de servicio (ahorra una consulta a la base).
 *   - exigirCuerpo            -> si no hay cuerpo JSON, 400 inmediato.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * GET    /api/roles                     Lista con filtros y paginacion
 * GET    /api/roles/:id                 Detalle (incluye permisos)
 * POST   /api/roles                     Crear
 * PUT    /api/roles/:id                 Actualizar
 * PATCH  /api/roles/:id/estado          Cambiar estado (activo/inactivo)
 * DELETE /api/roles/:id                 Eliminar (409 si tiene usuarios)
 * POST   /api/roles/:id/permisos        Asignar permiso (body: idPermiso)
 * DELETE /api/roles/:id/permisos/:idPermiso  Quitar permiso
 * ---------------------------------------------------------------------
 */

const { Router } = require('express');

const rolController = require('../controllers/rol.controller');
const { validarIdNumerico, exigirCuerpo } = require('../middleware/validarParametros');

const router = Router();

// ---- Coleccion: /api/roles ----
router.get('/', rolController.listar);
router.post('/', exigirCuerpo, rolController.crear);

// ---- Recurso individual: /api/roles/:id ----
router.get('/:id', validarIdNumerico('id'), rolController.obtener);
router.put('/:id', validarIdNumerico('id'), exigirCuerpo, rolController.actualizar);

// Ruta mas especifica que /:id, asi que va declarada en cualquier
// posicion valida: Express la evalua y coincide primero por el literal.
router.patch('/:id/estado', validarIdNumerico('id'), exigirCuerpo, rolController.cambiarEstado);

router.delete('/:id', validarIdNumerico('id'), rolController.eliminar);

// ---- Relacion N:M rol<->permiso ----
// El id del permiso a asignar va en el BODY; el id a quitar, en la URL
// (porque DELETE no acepta cuerpo de forma portable).
router.post('/:id/permisos', validarIdNumerico('id'), exigirCuerpo, rolController.asignarPermiso);
router.delete('/:id/permisos/:idPermiso', validarIdNumerico('id', 'idPermiso'), rolController.quitarPermiso);

module.exports = router;
