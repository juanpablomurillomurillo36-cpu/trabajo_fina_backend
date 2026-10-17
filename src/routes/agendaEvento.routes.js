/**
 * src/routes/agendaEvento.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/agenda-eventos` — JWT + permiso `eventos.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const agendaEventoController = require('../controllers/agendaEvento.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('eventos.gestionar'));

router.get('/', agendaEventoController.listar);
router.get('/:id', validarIdNumerico('id'), agendaEventoController.obtenerPorId);
router.post('/', agendaEventoController.crear);
router.put('/:id', validarIdNumerico('id'), agendaEventoController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), agendaEventoController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), agendaEventoController.eliminar);

module.exports = router;
