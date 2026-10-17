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
const fichaTecnicaController = require('../controllers/fichaTecnica.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('eventos.gestionar'));

router.get('/', eventoController.listar);
router.get('/:id', validarIdNumerico('id'), eventoController.obtenerPorId);
router.post('/', eventoController.crear);
router.put('/:id', validarIdNumerico('id'), eventoController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), eventoController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), eventoController.eliminar);

// Ficha tecnica ANIDADA: composicion 1:1 del evento (fase 39).
router.get('/:id/ficha', validarIdNumerico('id'), fichaTecnicaController.obtener);
router.post('/:id/ficha', validarIdNumerico('id'), fichaTecnicaController.crear);
router.put('/:id/ficha', validarIdNumerico('id'), fichaTecnicaController.actualizar);
router.delete('/:id/ficha', validarIdNumerico('id'), fichaTecnicaController.eliminar);

module.exports = router;
