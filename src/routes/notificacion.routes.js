/**
 * src/routes/notificacion.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/notificaciones` — JWT + permiso
 * `notificaciones.gestionar`. Envios SIMULADOS (RN-12).
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const notificacionController = require('../controllers/notificacion.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('notificaciones.gestionar'));

router.get('/', notificacionController.listar);
router.get('/:id', validarIdNumerico('id'), notificacionController.obtenerPorId);
router.post('/', notificacionController.crear);
// Lote de cumpleanos (RF-VEN-15): ruta literal ANTES de '/:id' para
// que 'cumpleanos' nunca se interprete como un id numerico.
router.post('/cumpleanos', notificacionController.notificarCumpleanos);

module.exports = router;
