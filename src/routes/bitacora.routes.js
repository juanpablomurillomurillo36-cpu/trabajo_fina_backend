/**
 * src/routes/bitacora.routes.js
 * ---------------------------------------------------------------------
 * CAPA DE RUTAS de la bitacora: declara el CONTRATO HTTP.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * GET /api/bitacora                    Listado (filtros: tabla, accion,
 *                                      idUsuario, pagina, limite)
 * GET /api/bitacora/:tabla/:idRegistro Historial de un registro
 * ---------------------------------------------------------------------
 *
 * PROTECCION: la auditoria revela QUIEN hizo QUE; verla es tan
 * sensible como editar. Se exige token + permiso `bitacora.consultar`
 * (la rúbrica C7 exige autorizacion por permisos, no solo por rol).
 */

const { Router } = require('express');

const bitacoraController = require('../controllers/bitacora.controller');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const { validarIdNumerico } = require('../middleware/validarParametros');

const router = Router();

// Todas las rutas pasan por autenticacion + permiso de consulta.
router.use(requiereAutenticacion, requierePermiso('bitacora.consultar'));

router.get('/', bitacoraController.listar);
router.get('/:tabla/:idRegistro', validarIdNumerico('idRegistro'), bitacoraController.listarDeRegistro);

module.exports = router;
