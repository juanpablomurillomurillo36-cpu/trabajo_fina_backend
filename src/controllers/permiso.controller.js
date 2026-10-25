/**
 * src/controllers/permiso.controller.js
 * ---------------------------------------------------------------------
 * CAPA DE CONTROLADOR de la entidad Permiso.
 *
 * Traduce entre HTTP y el service; nada mas. No hay SQL, ni reglas de
 * negocio, ni calculos: si los hay, estan en la capa equivocada.
 *
 * MANEJO DE ERRORES: CADA METODO TRA SU PROPIO try/catch y hace
 * `next(error)` para que el middleware manejadorErrores decida el
 * codigo HTTP, el mensaje y el log.
 *
 * TABLA DE ENDPOINTS QUE ATENDER
 * ---------------------------------------------------------------------
 * GET    /api/permisos              Listado con filtros y paginacion
 * GET    /api/permisos/:id          Detalle
 * POST   /api/permisos              Crear (201 + Location)
 * PUT    /api/permisos/:id          Actualizar (parcial)
 * PATCH  /api/permisos/:id/estado   Cambiar estado
 * DELETE /api/permisos/:id          Eliminar
 * ---------------------------------------------------------------------
 */

const permisoService = require('../services/permiso.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');

class PermisoController {
  /**
   * GET /api/permisos
   * ?estado=activo&busqueda=roles&pagina=1&limite=20
   */
  listar = async (req, res, next) => {
    try {
      const { permisos, total, pagina, limite } = await permisoService.listar(req.query);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_LISTADO,
        datos: permisos,
        meta: respuesta.construirMeta({ total, pagina, limite, devueltos: permisos.length })
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/permisos/:id
   */
  obtener = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const permiso = await permisoService.obtenerPorId(id);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_OBTENIDO,
        datos: permiso
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/permisos  -> 201 Created + cabecera Location
   */
  crear = async (req, res, next) => {
    try {
      const permiso = await permisoService.crear(req.body);

      res.set('Location', `/api/permisos/${permiso.id}`);

      return respuesta.creado(res, {
        mensaje: MENSAJES.EXITO.RECURSO_CREADO,
        datos: permiso
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/permisos/:id  -> actualizacion parcial
   */
  actualizar = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const permiso = await permisoService.actualizar(id, req.body);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ACTUALIZADO,
        datos: permiso
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/permisos/:id/estado  { "estado": "inactivo" }
   */
  cambiarEstado = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;
      const { estado } = req.body;

      const permiso = await permisoService.cambiarEstado(id, estado);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ESTADO_ACTUALIZADO,
        datos: permiso
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/permisos/:id
   * Devuelve 200 con un resumen, en vez de 204 sin contenido, para
   * que en las pruebas se pueda VER que efectivamente borro.
   */
  eliminar = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const resumen = await permisoService.eliminar(id);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ELIMINADO,
        datos: resumen
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new PermisoController();
