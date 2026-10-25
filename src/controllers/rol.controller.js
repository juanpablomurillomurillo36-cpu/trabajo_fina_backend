/**
 * src/controllers/rol.controller.js
 * ---------------------------------------------------------------------
 * CAPA DE CONTROLADOR de la entidad Rol.
 *
 * SU UNICA RESPONSABILIDAD: traducir entre HTTP y el servicio.
 *
 *   ENTRADA : saca los datos de req (params, query, body).
 *   DELEGA  : llama al service, que es quien sabe las reglas.
 *   SALIDA  : arma la respuesta HTTP con el codigo correcto.
 *
 * REGLA PARA RECONOCER UN CONTROLADOR BIEN HECHO:
 * No debe contener NI UNA consulta SQL, NI UNA validacion de negocio,
 * NI UN calculo. Si ves un `SELECT` o un `if (total > 0)` aqui, esa
 * logica esta en la capa equivocada.
 *
 * Un controlador "delgado" suele tener entre 3 y 8 lineas por metodo.
 *
 * DE DONDE SALEN LOS DATOS?
 *   req.params -> de la ruta        /api/roles/7     -> { id: '7' }
 *   req.query  -> de la query       ?pagina=2&limite=10
 *   req.body   -> del cuerpo JSON   { "nombreRol": ... }
 *
 * OJO: req.params y req.query SIEMPRE traen TEXTO, nunca numeros.
 * Por eso el middleware validarIdNumerico ya dejo el id convertido en
 * req.idsValidados.
 *
 * MANEJO DE ERRORES: CADA METODO TRA SU PROPIO try/catch.
 * Si el service lanza (404, 409, 400...), el catch hace `next(error)`
 * y el error viaja al middleware manejadorErrores, que es el unico que
 * decide codigo HTTP, mensaje y log.
 */

const rolService = require('../services/rol.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');

class RolController {
  /**
   * GET /api/roles
   * Lista roles con filtros y paginacion.
   *
   * Query admitida: ?estado=activo&busqueda=adm&pagina=1&limite=20
   */
  listar = async (req, res, next) => {
    try {
      const { roles, total, pagina, limite } = await rolService.listar(req.query);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_LISTADO,

        // roles es un arreglo de objetos Rol. Al serializar,
        // JSON.stringify llama al toJSON() de cada uno automaticamente.
        datos: roles,
        meta: respuesta.construirMeta({ total, pagina, limite, devueltos: roles.length })
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/roles/:id
   * Detalle de un rol, YA CON SU ARREGLO DE PERMISOS cargado.
   */
  obtener = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const rol = await rolService.obtenerPorId(id);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_OBTENIDO,
        datos: rol
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/roles
   * Crea un rol.
   *
   * Responde 201 Created y no 200: es el codigo correcto cuando la
   * peticion genera un recurso nuevo en el servidor.
   */
  crear = async (req, res, next) => {
    try {
      const rol = await rolService.crear(req.body);

      // Cabecera Location: le dice al cliente en que URL quedo el
      // recurso recien creado. Es parte del estandar REST.
      res.set('Location', `/api/roles/${rol.id}`);

      return respuesta.creado(res, {
        mensaje: MENSAJES.EXITO.RECURSO_CREADO,
        datos: rol
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/roles/:id
   * Actualiza un rol (acepta actualizacion parcial).
   */
  actualizar = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const rol = await rolService.actualizar(id, req.body);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ACTUALIZADO,
        datos: rol
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/roles/:id/estado
   * Cambia unicamente el estado (activo/inactivo).
   *
   * Se usa PATCH y no PUT porque no se reemplaza el recurso completo:
   * solo se toca un fragmento de el.
   */
  cambiarEstado = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;
      const { estado } = req.body;

      const rol = await rolService.cambiarEstado(id, estado);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ESTADO_ACTUALIZADO,
        datos: rol
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/roles/:id
   * Elimina el rol (las asignaciones de permisos caen en cascada).
   *
   * Devolvemos 200 con un resumen de lo borrado en lugar de 204
   * (sin contenido): al aprendiz le sirve VER que se elimino.
   */
  eliminar = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const resumen = await rolService.eliminar(id);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ELIMINADO,
        datos: resumen
      });
    } catch (error) {
      next(error);
    }
  };

  // =================================================================
  // SUB-RECURSO: /api/roles/:id/permisos
  // ================================================================

  /**
   * POST /api/roles/:id/permisos  { "idPermiso": 3 }
   * Asigna un permiso al rol.
   *
   * Responde 200 y NO 201: no nace un recurso nuevo en la coleccion
   * de permisos (el permiso ya existia); lo que cambia es la RELACION
   * con un rol que ya estaba. La convencion en sub-recursos de estado
   * es responder con el recurso actualizado.
   */
  asignarPermiso = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;
      const { idPermiso } = req.body;

      const rol = await rolService.asignarPermiso(id, idPermiso);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.PERMISO_ASIGNADO,
        datos: rol
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/roles/:id/permisos/:idPermiso
   * Retira un permiso del rol.
   *
   * Devuelve 200 con `datos` como ARREGLO de los permisos que
   * QUEDARON. Si fuera el ultimo, el service responde 409: un rol sin
   * permisos no sirve para nada.
   */
  quitarPermiso = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;
      const idPermiso = req.idsValidados.idPermiso;

      const permisosRestantes = await rolService.quitarPermiso(id, idPermiso);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.PERMISO_QUITADO,
        datos: permisosRestantes
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new RolController();
