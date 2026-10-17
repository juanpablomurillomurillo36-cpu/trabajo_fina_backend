/**
 * src/config/express.js
 * ---------------------------------------------------------------------
 * UNICO lugar donde se arma la aplicacion Express.
 *
 * POR QUE ESTA EN CARPETA config/ Y NO EN index.js?
 *   Para separar dos responsabilidades:
 *      - express.js  -> COMO esta construida la app (middleware, rutas).
 *      - index.js    -> CICLO DE VIDA (arrancar, verificar BD, apagar).
 *   Con esto, para escribir pruebas basta con llamar a
 *   crearAplicacion() sin que el servidor escuche en un puerto.
 *
 * ORDEN DE LOS MIDDLEWARES: IMPORTANTE
 * ---------------------------------------------------------------------
 *   Express ejecuta los middleware en el ORDEN en que se registran.
 *   Por eso el orden de abajo no es caprichoso:
 *
 *      1. CORS          -> antes de leer cualquier cuerpo.
 *      2. express.json  -> convierte el cuerpo JSON a req.body.
 *      3. rutas         -> logica de la API (solo llega cuerpo valido).
 *      4. 404           -> si ninguna ruta coincidio, informa.
 *      5. manejador errores -> ULTIMO: atrapa cualquier throw anterior.
 *
 *   Si el manejador de errores se pusiera antes de las rutas, nunca
 *   veria los errores que ocurren dentro de un controller.
 */

const express = require('express');
const cors = require('cors');

const configuracion = require('./env');
const { rutaNoEncontrada, manejadorErrores } = require('../middleware/errorHandler');
const { registrarAviso } = require('../middleware/logger');

// Cada modulo de rutas se monta aqui. Agregar una parte nueva del
// proyecto consiste en una linea nueva.
const rutaSalud = require('../routes/salud.routes');
const rutaPermiso = require('../routes/permiso.routes');
const rutaRol = require('../routes/rol.routes');
const rutaUsuario = require('../routes/usuario.routes');

  const rutaAuth = require('../routes/auth.routes');

  const rutaBitacora = require('../routes/bitacora.routes');

const rutaProveedor = require('../routes/proveedor.routes');

const rutaProducto = require('../routes/producto.routes');

const rutaServicio = require('../routes/servicio.routes');

const rutaCategoriaEmpleado = require('../routes/categoriaEmpleado.routes');
const rutaCategoriaCliente = require('../routes/categoriaCliente.routes');

const rutaEmpleado = require('../routes/empleado.routes');

const rutaCliente = require('../routes/cliente.routes');

const rutaCompra = require('../routes/compra.routes');

const rutaInventario = require('../routes/inventario.routes');

/**
 * Decide si un origen (frontend) tiene permiso para llamar a la API.
 *
 * Se usa en forma de funcion porque:
 *   - peticiones SIN cabecera Origin (Postman, curl) deben pasar;
 *   - asi podemos dejar registro de los intentos rechazados.
 *
 * @param {string|undefined} origen  Valor de la cabecera Origin
 * @param {function} callback        (error, permitido)
 */
function resolverOrigen(origen, callback) {
  // Postman y curl no envian Origin; no hay que bloquearlos.
  if (!origen) {
    return callback(null, true);
  }

  const permitido = configuracion.origenesPermitidos.includes(origen);

  if (!permitido) {
    registrarAviso('CORS_ORIGEN_RECHAZADO', { origen });
  }

  // callback(null, false) NO corta la peticion: simplemente no agrega
  // las cabeceras CORS, y el navegador es quien la bloquea del lado
  // del cliente.
  return callback(null, permitido);
}

/**
 * Crea y configura la aplicacion Express.
 *
 * @returns {object} instancia de app lista para app.listen()
 */
function crearAplicacion() {
  const app = express();

  // ---- 1. Cabeceras de seguridad basics ----

  // Express agrega "X-Powered-By: Express" a cada respuesta. Decirle
  // al atacante que framework usas le ahorra trabajo: se desactiva.
  app.disable('x-powered-by');

  // URLencoded evita que Express interprete formularios; aqui solo
  // consumimos JSON. Se limita el tamano del cuerpo a 10 MB para que
  // nadie mande un payload gigante y agote la memoria del servidor.
  app.use(express.json({ limit: '10mb' }));

  // ---- 2. CORS ----
  app.use(
    cors({
      origin: resolverOrigen,
      // Permite enviar cookies/cabeceras de autorizacion.
      credentials: true,
      // Permite los metodos que usa la API REST.
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      // Permite la cabecera Authorization (tokens JWT).
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );

  // ---- 3. Rutas de la API ----
  // Todas se montan bajo /api para que quede claro que es un backend
  // y no sirva paginas HTML.
  app.use('/api/salud', rutaSalud);

  // CRUD de permisos: la PRIMERA entidad con las 4 capas completas.
  app.use('/api/permisos', rutaPermiso);

  // CRUD de roles. A partir de aqui cada entidad nueva solo agrega
  // dos lineas: el require de arriba y este montaje.
  app.use('/api/roles', rutaRol);

  // Cuentas de usuario del sistema (el CRUD de credenciales).
  app.use('/api/usuarios', rutaUsuario);

  // Sesion: login, logout, registro publico y perfil propio. Todo lo
  // que necesite token se protege DENTRO de sus propias rutas.
  app.use('/api/auth', rutaAuth);

  // Auditoria de cambios (lectura): exigir permiso bitacora.consultar.
  app.use('/api/bitacora', rutaBitacora);

  // Catalogo de proveedores.
  app.use('/api/proveedores', rutaProveedor);

  // Catalogo de productos.
  app.use('/api/productos', rutaProducto);

  // Catalogo de servicios.
  app.use('/api/servicios', rutaServicio);

  // Catalogos de categorias (empleados y clientes bajo el mismo prefijo).
  app.use('/api/categorias/empleados', rutaCategoriaEmpleado);
  app.use('/api/categorias/clientes', rutaCategoriaCliente);

  // Ficha del personal.
  app.use('/api/empleados', rutaEmpleado);

  // Ficha de clientes.
  app.use('/api/clientes', rutaCliente);

  // Compras a proveedores (composicion compra+detalles).
  app.use('/api/compras', rutaCompra);

  // Inventario: alertas de stock minimo (RN-03).
  app.use('/api/inventario', rutaInventario);

  // ---- 4. Ruta inexistente (404) ----
  app.use(rutaNoEncontrada);

  // ---- 5. Manejador central de errores (SIEMPRE el ultimo) ----
  app.use(manejadorErrores);

  return app;
}

module.exports = {
  crearAplicacion
};
