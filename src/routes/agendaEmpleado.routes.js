/**
 * src/routes/agendaEmpleado.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/agenda` — JWT + permiso `empleados.gestionar`
 * (la agenda es asignacion del personal).
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const agendaEmpleadoController = require('../controllers/agenda-empleado.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('empleados.gestionar'));

router.get('/', agendaEmpleadoController.listar);
router.get('/:id', validarIdNumerico('id'), agendaEmpleadoController.obtenerPorId);
router.post('/', agendaEmpleadoController.crear);
router.put('/:id', validarIdNumerico('id'), agendaEmpleadoController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), agendaEmpleadoController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), agendaEmpleadoController.eliminar);

module.exports = router;
