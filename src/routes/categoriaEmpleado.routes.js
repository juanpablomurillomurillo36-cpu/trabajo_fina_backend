/**
 * src/routes/categoriaEmpleado.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/categorias/empleados` — JWT + permiso
 * `categorias.gestionar`.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');
const categoriaEmpleadoController = require('../controllers/categoria-empleado.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('categorias.gestionar'));

router.get('/', categoriaEmpleadoController.listar);
router.get('/:id', validarIdNumerico('id'), categoriaEmpleadoController.obtenerPorId);
router.post('/', categoriaEmpleadoController.crear);
router.put('/:id', validarIdNumerico('id'), categoriaEmpleadoController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), categoriaEmpleadoController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), categoriaEmpleadoController.eliminar);

module.exports = router;
