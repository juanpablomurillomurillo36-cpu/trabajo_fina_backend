/**
 * src/routes/index.js
 * ---------------------------------------------------------------------
 * ENRUTADOR PRINCIPAL: junta todos los routers en un solo lugar y les
 * asigna su prefijo de URL.
 *
 * Gracias a este archivo, config/express.js solo necesita UNA linea
 * (app.use('/api', rutas)) en lugar de cinco. Si manana se agrega la
 * entidad "proveedores", se registra aqui y nada mas.
 *
 * COMO FUNCIONA router.use(prefijo, otroRouter)?
 * Monta un router hijo bajo un prefijo. La URL final es la suma de los
 * prefijos de toda la cadena:
 *
 *     app.use('/api', rutas)                     -> /api
 *       router.use('/roles', rolRoutes)          -> /api/roles
 *         router.get('/:id', ...)                -> /api/roles/:id
 */

const express = require('express');

const saludRoutes = require('./salud.routes');
const rolRoutes = require('./rol.routes');
const permisoRoutes = require('./permiso.routes');
const usuarioRoutes = require('./usuario.routes');

const respuesta = require('../utils/respuesta');

const router = express.Router();

// ---------------------------------------------------------------------
// GET /api  -> Documento de descubrimiento (discovery document)
// ---------------------------------------------------------------------
// Una buena API REST se describe a si misma: al entrar a la raiz,
// devuelve la lista de recursos disponibles. Asi quien la consume no
// tiene que adivinar las URL ni adivinar que esta desplegado en esta
// fase del proyecto.
router.get('/', (req, res) => {
  return respuesta.exito(res, {
    mensaje: 'Bienvenido a discoteca-api. Estos son los recursos disponibles.',
    datos: {
      nombre: 'discoteca-api',
      version: '1.0.0',
      fase: 'Infraestructura, roles, permisos y usuarios',
      recursos: {
        roles: '/api/roles',
        permisos: '/api/permisos',
        usuarios: '/api/usuarios'
      },
      utilidades: {
        estadoSalud: '/api/salud'
      }
    }
  });
});

// ---------------------------------------------------------------------
// Montaje de los routers de cada entidad
// ---------------------------------------------------------------------
router.use('/salud', saludRoutes);
router.use('/roles', rolRoutes);
router.use('/permisos', permisoRoutes);
router.use('/usuarios', usuarioRoutes);

module.exports = router;
