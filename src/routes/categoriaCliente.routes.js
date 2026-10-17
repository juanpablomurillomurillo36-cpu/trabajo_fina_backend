/**
 * src/routes/categoriaCliente.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/categorias/clientes` — JWT + permiso
 * `categorias.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const categoriaClienteController = require('../controllers/categoria-cliente.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('categorias.gestionar'));

router.get('/', categoriaClienteController.listar);
router.get('/:id', validarIdNumerico('id'), categoriaClienteController.obtenerPorId);
router.post('/', categoriaClienteController.crear);
router.put('/:id', validarIdNumerico('id'), categoriaClienteController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), categoriaClienteController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), categoriaClienteController.eliminar);

module.exports = router;
