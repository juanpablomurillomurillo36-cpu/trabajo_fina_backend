/**
 * src/routes/venta.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/ventas` — JWT + permiso `ventas.gestionar`.
 * La fase 42 agregara /:id/pagar y /:id/anular.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const ventaController = require('../controllers/venta.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('ventas.gestionar'));

router.get('/', ventaController.listar);
router.get('/:id', validarIdNumerico('id'), ventaController.obtenerPorId);
router.post('/', ventaController.crear);
router.put('/:id', validarIdNumerico('id'), ventaController.actualizar);
router.delete('/:id', validarIdNumerico('id'), ventaController.eliminar);

module.exports = router;
