/**
 * src/routes/salud.routes.js
 * ---------------------------------------------------------------------
 * RUTAS de salud de la API.
 *
 * TABLA DE ENDPOINTS
 * ---------------------------------------------------------------------
 * GET /api/salud   Estado de la API y de la base de datos
 * ---------------------------------------------------------------------
 */

const express = require('express');

const saludController = require('../controllers/salud.controller');

const router = express.Router();

// GET /api/salud
router.get('/', saludController.verificar);

module.exports = router;
