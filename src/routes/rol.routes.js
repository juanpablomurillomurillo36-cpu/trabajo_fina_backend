/**
 * src/routes/rol.routes.js
 * ---------------------------------------------------------------------
 * CAPA DE RUTAS de la entidad Rol.
 *
 * DECLARA EL CONTRATO: que verbo HTTP + que URL ejecuta que controlador
 * y por que middlewares pasa antes. Es la "tabla de contenido" de la
 * API: cualquiera puede abrir este archivo y saber en 20 segundos todo
 * lo que permite hacer con los roles.
 *
 * express.Router() crea un mini-aplicacion de rutas que luego se monta
 * bajo '/api/roles'. Aqui la ruta '/' se convierte en '/api/roles'.
 *
 * EL ORDEN DE LAS RUTAS IMPORTA
 * Express evalua de arriba hacia abajo y se detiene en la PRIMERA que
 * coincide. Por eso el sub-recurso '/:id/permisos' va ANTES de '/:id':
 * de lo contrario, GET /api/roles/5/permisos lo atraparia '/:id' con
 * id = "5/permisos" y nunca llegaria a donde debe.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * GET    /api/roles                              Listado
 * POST   /api/roles                              Crear (201)
 * GET    /api/roles/:id                          Detalle con permisos
 * PUT    /api/roles/:id                          Actualizar
 * PATCH  /api/roles/:id/estado                   Cambiar estado
 * DELETE /api/roles/:id                          Eliminar
 * POST   /api/roles/:id/permisos                 Asignar permiso (200)
 * DELETE /api/roles/:id/permisos/:idPermiso      Quitar permiso (200)
 * ---------------------------------------------------------------------
 *
 * NINGUNA RUTA TIENE MIDDLEWARE DE AUTENTICACION en esta fase: las
 * rutas estan abiertas a proposito mientras se prueba en Postman. El
 * JWT se montara despues, en la fase de seguridad.
 */

const express = require('express');

const rolController = require('../controllers/rol.controller');
const { validarIdNumerico, exigirCuerpo } = require('../middleware/validarParametros');

const router = express.Router();

// ---------------------------------------------------------------------
// Coleccion: /api/roles
// ---------------------------------------------------------------------

// GET /api/roles
router.get('/', rolController.listar);

// POST /api/roles
// exigirCuerpo corre ANTES del controlador y rechaza cuerpos vacios.
router.post('/', exigirCuerpo, rolController.crear);

// ---------------------------------------------------------------------
// Sub-recurso de permisos (va ANTES de '/:id' por el orden de evaluacion)
// ---------------------------------------------------------------------

// POST /api/roles/:id/permisos
router.post(
  '/:id/permisos',
  validarIdNumerico('id'),
  exigirCuerpo,
  rolController.asignarPermiso
);

// DELETE /api/roles/:id/permisos/:idPermiso
router.delete(
  '/:id/permisos/:idPermiso',
  validarIdNumerico('id'),
  validarIdNumerico('idPermiso'),
  rolController.quitarPermiso
);

// ---------------------------------------------------------------------
// Recurso individual: /api/roles/:id
// ---------------------------------------------------------------------

// GET /api/roles/:id
router.get('/:id', validarIdNumerico('id'), rolController.obtener);

// PUT /api/roles/:id
router.put('/:id', validarIdNumerico('id'), exigirCuerpo, rolController.actualizar);

// PATCH /api/roles/:id/estado
router.patch('/:id/estado', validarIdNumerico('id'), exigirCuerpo, rolController.cambiarEstado);

// DELETE /api/roles/:id
router.delete('/:id', validarIdNumerico('id'), rolController.eliminar);

module.exports = router;
