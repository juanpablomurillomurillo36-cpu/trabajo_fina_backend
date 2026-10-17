/**
 * src/routes/permiso.routes.js
 * ---------------------------------------------------------------------
 * CAPA DE RUTAS de la entidad Permiso.
 *
 * QUE HACE UNA RUTA?
 * Declara el CONTRATO de la API: que verbo HTTP + que URL ejecuta que
 * controlador, y por que middlewares pasa antes.
 *
 * Es la "tabla de contenido" de la API. Cualquiera puede abrir este
 * archivo y saber en 20 segundos todo lo que la API permite hacer con
 * los permisos.
 *
 * express.Router() crea un mini-aplicacion de rutas que luego se monta
 * en un prefijo. Al montarlo en '/api/permisos', la ruta '/' de aqui
 * se convierte en '/api/permisos'.
 *
 * EL ORDEN DE LAS RUTAS IMPORTA
 * Express evalua de arriba hacia abajo y se detiene en la PRIMERA que
 * coincide.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * GET    /api/permisos               Lista con filtros y paginacion
 * GET    /api/permisos/:id           Detalle
 * POST   /api/permisos               Crear
 * PUT    /api/permisos/:id           Actualizar
 * PATCH  /api/permisos/:id/estado    Cambiar estado (activo/inactivo)
 * DELETE /api/permisos/:id           Eliminar (si no esta en uso)
 * ---------------------------------------------------------------------
 *
 * PROTECCION (fase 22): todo el CRUD exige token + permiso
 * `permisos.gestionar` (quien otorga permisos es super-administrador
 * de facto).
 */

const { Router } = require('express');

const permisoController = require('../controllers/permiso.controller');
const { validarIdNumerico, exigirCuerpo } = require('../middleware/validarParametros');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');

const router = Router();

// Proteccion GLOBAL de la ruta: todo lo que sigue pasa por aqui.
router.use(requiereAutenticacion, requierePermiso('permisos.gestionar'));

// ---------------------------------------------------------------------
// Coleccion: /api/permisos
// ---------------------------------------------------------------------

// GET /api/permisos
router.get('/', permisoController.listar);

// POST /api/permisos
// exigirCuerpo corre ANTES del controlador y rechaza cuerpos vacios
// con un 400 claro, en vez de dejar que falle la validacion de campos.
router.post('/', exigirCuerpo, permisoController.crear);

// ---------------------------------------------------------------------
// Recurso individual: /api/permisos/:id
// ---------------------------------------------------------------------

// GET /api/permisos/:id
router.get('/:id', validarIdNumerico('id'), permisoController.obtener);

// PUT /api/permisos/:id
router.put('/:id', validarIdNumerico('id'), exigirCuerpo, permisoController.actualizar);

// PATCH /api/permisos/:id/estado  (ruta mas especifica que /:id)
router.patch('/:id/estado', validarIdNumerico('id'), exigirCuerpo, permisoController.cambiarEstado);

// DELETE /api/permisos/:id
router.delete('/:id', validarIdNumerico('id'), permisoController.eliminar);

module.exports = router;
