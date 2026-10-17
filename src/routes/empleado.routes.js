/**
 * src/routes/empleado.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/empleados` — JWT + permiso `empleados.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const empleadoController = require('../controllers/empleado.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('empleados.gestionar'));

router.get('/', empleadoController.listar);
router.get('/:id', validarIdNumerico('id'), empleadoController.obtenerPorId);
router.post('/', empleadoController.crear);
router.put('/:id', validarIdNumerico('id'), empleadoController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), empleadoController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), empleadoController.eliminar);

module.exports = router;
