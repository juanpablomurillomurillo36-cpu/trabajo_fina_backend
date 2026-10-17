/**
 * src/routes/evento.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/eventos` — JWT + permiso `eventos.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const eventoController = require('../controllers/evento.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('eventos.gestionar'));

router.get('/', eventoController.listar);
router.get('/:id', validarIdNumerico('id'), eventoController.obtenerPorId);
router.post('/', eventoController.crear);
router.put('/:id', validarIdNumerico('id'), eventoController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), eventoController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), eventoController.eliminar);

module.exports = router;
