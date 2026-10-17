/**
 * src/routes/programa-puntos.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/puntos` — JWT + permiso `clientes.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const programaPuntosController = require('../controllers/programa-puntos.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('clientes.gestionar'));

router.get('/:idCliente', validarIdNumerico('idCliente'), programaPuntosController.saldo);
router.post(
  '/:idCliente/canjear',
  validarIdNumerico('idCliente'),
  programaPuntosController.canjear
);

module.exports = router;
