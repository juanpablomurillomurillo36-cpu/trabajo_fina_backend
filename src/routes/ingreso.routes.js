/**
 * src/routes/ingreso.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/ingresos` — JWT + permiso `ingresos.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const ingresoController = require('../controllers/ingreso.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('ingresos.gestionar'));

router.get('/', ingresoController.listar);
router.get('/:id', validarIdNumerico('id'), ingresoController.obtenerPorId);
router.post('/validar', ingresoController.validar);

module.exports = router;
