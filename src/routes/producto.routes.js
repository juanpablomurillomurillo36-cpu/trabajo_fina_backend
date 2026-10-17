/**
 * src/routes/producto.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/productos` — protegidas con JWT + permiso
 * `productos.gestionar` leido de la BD.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const productoController = require('../controllers/producto.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('productos.gestionar'));

router.get('/', productoController.listar);
router.get('/:id', validarIdNumerico('id'), productoController.obtenerPorId);
router.post('/', productoController.crear);
router.put('/:id', validarIdNumerico('id'), productoController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), productoController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), productoController.eliminar);

module.exports = router;
