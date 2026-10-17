/**
 * src/routes/inventario.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/inventario` — JWT + permiso `productos.gestionar`
 * (es una vista del stock del catalogo de productos).
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const inventarioController = require('../controllers/inventario.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('productos.gestionar'));

router.get('/alertas', inventarioController.alertas);

module.exports = router;
