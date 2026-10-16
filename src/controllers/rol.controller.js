/**
 * src/controllers/rol.controller.js
 * ---------------------------------------------------------------------
 * CAPA DE CONTROLADOR de la entidad Rol.
 *
 * Traduce HTTP <-> RolService. Nada de SQL, nada de reglas de negocio:
 * si este archivo creciera hasta contener un `if` de negocio, estaria
 * roto el diseño por capas (C3).
 *
 * Los errores salen solos: cada metodo esta envuelto en capturarAsync,
 * que deriva cualquier throw al manejador central. POR ESO AQUI NO HAY
 * NI UN try/catch.
 *
 * TABLA DE ENDPOINTS (tambien esta en routes/rol.routes.js)
 *   GET    /api/roles               Lista con filtros y paginacion
 *   GET    /api/roles/:id           Detalle con sus permisos
 *   POST   /api/roles               Crear
 *   PUT    /api/roles/:id           Actualizar
 *   PATCH  /api/roles/:id/estado    Cambiar estado
 *   DELETE /api/roles/:id           Eliminar (si no esta en uso)
 */

const rolService = require('../services/rol.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const { capturarAsync } = require('../middleware/errorHandler');

class RolController {
  /** GET /api/roles */
  listar = capturarAsync(async (req, res) => {
    const { roles, total, pagina, limite } = await rolService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('roles'),
      datos: roles,
      meta: respuesta.construirMeta({
        total,
        pagina,
        limite,
        devueltos: roles.length
      })
    });
  });

  /** GET /api/roles/:id  (devuelve el rol con `permisos` cargados) */
  obtener = capturarAsync(async (req, res) => {
    const rol = await rolService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Rol'),
      datos: rol
    });
  });

  /** POST /api/roles -> 201 + cabecera Location */
  crear = capturarAsync(async (req, res) => {
    const rol = await rolService.crear(req.body);

    // El estandar REST dice que al crear un recurso se informe DONDE
    // quedo: quien recibe 201 puede hacer GET a esa URL sin adivinar.
    res.set('Location', `/api/roles/${rol.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Rol'),
      datos: rol
    });
  });

  /** PUT /api/roles/:id */
  actualizar = capturarAsync(async (req, res) => {
    const rol = await rolService.actualizar(req.idsValidados.id, req.body);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Rol'),
      datos: rol
    });
  });

  /** PATCH /api/roles/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const rol = await rolService.cambiarEstado(req.idsValidados.id, req.body);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: rol
    });
  });

  /** DELETE /api/roles/:id */
  eliminar = capturarAsync(async (req, res) => {
    const resumen = await rolService.eliminar(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Rol'),
      datos: resumen
    });
  });
}

// SINGLETON
module.exports = new RolController();
