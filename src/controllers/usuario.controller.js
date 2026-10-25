/**
 * src/controllers/usuario.controller.js
 * ---------------------------------------------------------------------
 * CAPA DE CONTROLADOR de la entidad Usuario.
 *
 * Traduce entre HTTP y el service. Nada de SQL, nada de reglas de
 * negocio: esas viven en services/usuario.service.js.
 *
 * MANEJO DE ERRORES: CADA METODO TRA SU PROPIO try/catch y hace
 * `next(error)` para que el middleware manejadorErrores decida el
 * codigo HTTP, el mensaje y el log.
 *
 * TABLA DE ENDPOINTS QUE ATENDER
 * ---------------------------------------------------------------------
 * GET    /api/usuarios               Listado con filtros y paginacion
 * GET    /api/usuarios/:id           Detalle
 * POST   /api/usuarios               Crear (201 + Location)
 * PUT    /api/usuarios/:id           Actualizar (parcial)
 * PATCH  /api/usuarios/:id/estado    Cambiar estado
 * DELETE /api/usuarios/:id           Eliminar
 * ---------------------------------------------------------------------
 *
 * NOTA SOBRE LA CONTRASENA: este controlador recibe `contrasena` en
 * el cuerpo y la pasa al service tal cual. No la toca, no la guarda,
 * no la registra. El logger del middleware la enmascara con *** antes
 * de imprimirla.
 */

const usuarioService = require('../services/usuario.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');

class UsuarioController {
  /**
   * GET /api/usuarios
   * ?estado=activo&busqueda=ana&idRol=5&pagina=1&limite=20
   *
   * La respuesta NUNCA incluye contrasenaHash: eso lo garantiza
   * Usuario.toJSON(), que no lo serializa.
   */
  listar = async (req, res, next) => {
    try {
      const { usuarios, total, pagina, limite } = await usuarioService.listar(req.query);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_LISTADO,
        datos: usuarios,
        meta: respuesta.construirMeta({ total, pagina, limite, devueltos: usuarios.length })
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/usuarios/:id
   */
  obtener = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const usuario = await usuarioService.obtenerPorId(id);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_OBTENIDO,
        datos: usuario
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/usuarios  -> 201 Created + Location
   */
  crear = async (req, res, next) => {
    try {
      const usuario = await usuarioService.crear(req.body);

      res.set('Location', `/api/usuarios/${usuario.id}`);

      return respuesta.creado(res, {
        mensaje: MENSAJES.EXITO.RECURSO_CREADO,
        datos: usuario
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/usuarios/:id  -> actualizacion parcial
   *
   * Puede traer solo un campo ({"telefono": "..."}) o incluir
   * `contrasena` para cambiarla; en ese caso el service la hashea.
   */
  actualizar = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const usuario = await usuarioService.actualizar(id, req.body);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ACTUALIZADO,
        datos: usuario
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/usuarios/:id/estado  { "estado": "inactivo" }
   */
  cambiarEstado = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;
      const { estado } = req.body;

      const usuario = await usuarioService.cambiarEstado(id, estado);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ESTADO_ACTUALIZADO,
        datos: usuario
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/usuarios/:id
   */
  eliminar = async (req, res, next) => {
    try {
      const id = req.idsValidados.id;

      const resumen = await usuarioService.eliminar(id);

      return respuesta.exito(res, {
        mensaje: MENSAJES.EXITO.RECURSO_ELIMINADO,
        datos: resumen
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new UsuarioController();
