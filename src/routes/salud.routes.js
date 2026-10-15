/**
 * src/routes/salud.routes.js
 * ---------------------------------------------------------------------
 * Definicion de rutas del health check.
 *
 * QUIEN DEFINE LAS RUTAS?
 *   Las rutas van en archivos, NO dentro de los controllers. La capa
 *   `routes` solo decide QUE endpoint existe y QUE controller lo
 *   atiende. No valida, no calcula, no escribe en la base.
 *
 * Estructura de una ruta:
 *   router.<metodo>('<camino>', [middlewares...], controlador.<metodo>)
 *
 * Los middlewares entre el camino y el controller son OPCIONALES y se
 * usan para validar parametros de la URL (middleware/validarParametros)
 * o exigir autenticacion (fases posteriores).
 */

const { Router } = require('express');
const controlador = require('../controllers/salud.controller');

// Router() crea un "subconjunto" de rutas que despues se monta en
// config/express.js con app.use('/api/salud', ...).
const router = Router();

// GET /api/salud  ->  consulta general del servicio
router.get('/', controlador.verificar);

module.exports = router;
