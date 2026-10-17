/**
 * src/routes/proveedor.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/proveedores`.
 *
 * Proteccion global (R7): primero autenticacion (JWT) y despues
 * autorizacion por PERMISO de BD (`proveedores.gestionar`). Si no hay
 * token -> 401; si no tiene el permiso -> 403.
 *
 * Todas las rutas de mutacion quedan cubiertas por el bitacora del
 * controller.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const proveedorController = require('../controllers/proveedor.controller');

const router = Router();

// Proteccion del catalogo completo.
router.use(requiereAutenticacion, requierePermiso('proveedores.gestionar'));

router.get('/', proveedorController.listar);
router.get('/:id', validarIdNumerico('id'), proveedorController.obtenerPorId);
router.post('/', proveedorController.crear);
router.put('/:id', validarIdNumerico('id'), proveedorController.actualizar);
router.patch(
  '/:id/estado',
  validarIdNumerico('id'),
  proveedorController.cambiarEstado
);
router.delete(
  '/:id',
  validarIdNumerico('id'),
  proveedorController.eliminar
);

module.exports = router;
