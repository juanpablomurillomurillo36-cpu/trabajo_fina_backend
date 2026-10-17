/**
 * src/routes/servicio.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/servicios` — JWT + permiso `servicios.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const servicioController = require('../controllers/servicio.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('servicios.gestionar'));

router.get('/', servicioController.listar);
router.get('/:id', validarIdNumerico('id'), servicioController.obtenerPorId);
router.post('/', servicioController.crear);
router.put('/:id', validarIdNumerico('id'), servicioController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), servicioController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), servicioController.eliminar);

module.exports = router;
