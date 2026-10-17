/**
 * src/routes/venta.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/ventas` — JWT + permiso `ventas.gestionar`.
 * pagar/anular (RN-09/RN-10) en la fase 42.
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
router.post('/:id/pagar', validarIdNumerico('id'), ventaController.pagar);
router.post('/:id/anular', validarIdNumerico('id'), ventaController.anular);
router.delete('/:id', validarIdNumerico('id'), ventaController.eliminar);

module.exports = router;
