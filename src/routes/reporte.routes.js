/**
 * src/routes/reporte.routes.js
 * ---------------------------------------------------------------------
 * Rutas de `/api/reportes` — JWT + permiso `reportes.consultar`.
 * Las fases 46-48 van agregando endpoints de lectura.
 */

const { Router } = require('express');
const { requiereAutenticacion } = require('../middleware/autenticacion');
const { requierePermiso } = require('../middleware/autorizacion');
const reporteController = require('../controllers/reporte.controller');

const router = Router();

router.use(requiereAutenticacion, requierePermiso('reportes.consultar'));

router.get('/top-clientes', reporteController.topClientes);
router.get('/servicios-solicitados', reporteController.serviciosSolicitados);
router.get('/productos-menos-vendidos', reporteController.productosMenosVendidos);
router.get('/ventas-por-mes', reporteController.ventasPorMes);
router.get('/ventas-mayor-menor', reporteController.ventasMayorMenor);
router.get('/ventas-subtotales', reporteController.ventasSubtotales);

module.exports = router;
