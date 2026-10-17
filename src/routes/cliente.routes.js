/**
 * src/routes/cliente.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/clientes` — JWT + permiso `clientes.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const clienteController = require('../controllers/cliente.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('clientes.gestionar'));

router.get('/', clienteController.listar);
router.get('/:id', validarIdNumerico('id'), clienteController.obtenerPorId);
router.post('/', clienteController.crear);
router.put('/:id', validarIdNumerico('id'), clienteController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), clienteController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), clienteController.eliminar);

module.exports = router;
