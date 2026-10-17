/**
 * src/routes/compra.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/compras` — JWT + permiso `compras.gestionar`.
 * Fase 30: confirmar/cancelar con transaccion de stock (RN-01).
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const compraController = require('../controllers/compra.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('compras.gestionar'));

router.get('/', compraController.listar);
router.get('/:id', validarIdNumerico('id'), compraController.obtenerPorId);
router.post('/', compraController.crear);
router.put('/:id', validarIdNumerico('id'), compraController.actualizar);
router.delete('/:id', validarIdNumerico('id'), compraController.eliminar);

// Transiciones de estado (RN-01).
router.post('/:id/confirmar', validarIdNumerico('id'), compraController.confirmar);
router.post('/:id/cancelar', validarIdNumerico('id'), compraController.cancelar);

module.exports = router;
