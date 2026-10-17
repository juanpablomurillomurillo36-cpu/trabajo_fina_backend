/**
 * src/routes/reserva.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/reservas` — JWT + permiso `reservas.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const reservaController = require('../controllers/reserva.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('reservas.gestionar'));

router.get('/', reservaController.listar);
router.get('/:id', validarIdNumerico('id'), reservaController.obtenerPorId);
router.post('/', reservaController.crear);
router.put('/:id', validarIdNumerico('id'), reservaController.actualizar);
router.delete('/:id', validarIdNumerico('id'), reservaController.eliminar);

module.exports = router;
