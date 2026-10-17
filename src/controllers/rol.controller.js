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
 *   GET    /api/roles                     Lista con filtros y paginacion
 *   GET    /api/roles/:id                 Detalle con sus permisos
 *   POST   /api/roles                     Crear
 *   PUT    /api/roles/:id                 Actualizar
 *   PATCH  /api/roles/:id/estado          Cambiar estado
 *   DELETE /api/roles/:id                 Eliminar (si no esta en uso)
 *   POST   /api/roles/:id/permisos        Asignar un permiso (N:M)
 *   DELETE /api/roles/:id/permisos/:idPermiso  Quitar un permiso (N:M)
 *
 * AUDITORIA (fase 22): las MUTACIONES dejan evento en bitacora.
 */

const rolService = require('../services/rol.service');
const bitacoraService = require('../services/bitacora.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const { ACCION_BITACORA } = require('../utils/constants');
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

    await bitacoraService.registrarDesdeReq(req, {
      tabla: 'roles',
      accion: ACCION_BITACORA.CREACION,
      idRegistro: rol.id,
      detalle: `Rol "${rol.nombreRol}" creado`
    });

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

    await bitacoraService.registrarDesdeReq(req, {
      tabla: 'roles',
      accion: ACCION_BITACORA.EDICION,
      idRegistro: rol.id,
      detalle: `Rol "${rol.nombreRol}" actualizado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Rol'),
      datos: rol
    });
  });

  /** PATCH /api/roles/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const rol = await rolService.cambiarEstado(req.idsValidados.id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: 'roles',
      accion: ACCION_BITACORA.EDICION,
      idRegistro: rol.id,
      detalle: `Estado del rol "${rol.nombreRol}": ahora "${rol.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: rol
    });
  });

  /** DELETE /api/roles/:id */
  eliminar = capturarAsync(async (req, res) => {
    const resumen = await rolService.eliminar(req.idsValidados.id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: 'roles',
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: resumen.id,
      detalle: `Rol "${resumen.nombreRol}" eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Rol'),
      datos: resumen
    });
  });

  /**
   * POST /api/roles/:id/permisos
   * Body: { "idPermiso": 3 }
   *
   * El permiso va en el CUERPO porque lo que se crea es una FILA de la
   * tabla puente (la relacion rol<->permiso), no un recurso con URL
   * propia: no tiene sentido inventar un id para esa fila.
   */
  asignarPermiso = capturarAsync(async (req, res) => {
    const resultado = await rolService.asignarPermisoARol(
      req.idsValidados.id,
      req.body.idPermiso
    );

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Asignacion de permiso'),
      datos: resultado
    });
  });

  /** DELETE /api/roles/:id/permisos/:idPermiso */
  quitarPermiso = capturarAsync(async (req, res) => {
    const permisos = await rolService.quitarPermisoDeRol(
      req.idsValidados.id,
      req.idsValidados.idPermiso
    );

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Quita de permiso'),
      datos: permisos
    });
  });
}

// SINGLETON
module.exports = new RolController();
