/**
 * src/controllers/usuario.controller.js
 * ---------------------------------------------------------------------
 * CAPA DE CONTROLADOR de la entidad Usuario.
 *
 * Traduce HTTP <-> UsuarioService. Cero SQL, cero reglas de negocio,
 * cero try/catch (capturarAsync deriva los errores al manejador
 * central).
 *
 * OJO CON LA CONTRASENA: el service devuelve un objeto Usuario cuyo
 * toJSON() ya omite el hash. El controlador NO filtra nada: la proteccion
 * vive en el modelo, que es quien sabe que dato es sensible.
 *
 * TABLA DE ENDPOINTS
 *   GET    /api/usuarios               Lista con filtros y paginacion
 *   GET    /api/usuarios/:id           Detalle (con nombre del rol)
 *   POST   /api/usuarios               Crear (contrasena hasheada)
 *   PUT    /api/usuarios/:id           Actualizar
 *   PATCH  /api/usuarios/:id/estado    Activar / desactivar
 *   DELETE /api/usuarios/:id           Eliminar (409 si tiene historial)
 *
 * AUDITORIA (fase 22): cada MUTACION deja un evento en la bitacora
 * con quien la hizo (req.usuario) y desde que IP. Las lecturas no
 * se auditarian (serian ruido: el listado se consulta 100 veces).
 */

const usuarioService = require('../services/usuario.service');
const bitacoraService = require('../services/bitacora.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

class UsuarioController {
  /** GET /api/usuarios */
  listar = capturarAsync(async (req, res) => {
    const { usuarios, total, pagina, limite } = await usuarioService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('usuarios'),
      datos: usuarios,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: usuarios.length })
    });
  });

  /** GET /api/usuarios/:id */
  obtener = capturarAsync(async (req, res) => {
    const usuario = await usuarioService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Usuario'),
      datos: usuario
    });
  });

  /** POST /api/usuarios -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const usuario = await usuarioService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: 'usuarios',
      accion: ACCION_BITACORA.CREACION,
      idRegistro: usuario.id,
      detalle: `Usuario ${usuario.email} creado`
    });

    res.set('Location', `/api/usuarios/${usuario.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Usuario'),
      datos: usuario
    });
  });

  /** PUT /api/usuarios/:id */
  actualizar = capturarAsync(async (req, res) => {
    const usuario = await usuarioService.actualizar(req.idsValidados.id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: 'usuarios',
      accion: ACCION_BITACORA.EDICION,
      idRegistro: usuario.id,
      detalle: `Usuario ${usuario.email} actualizado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Usuario'),
      datos: usuario
    });
  });

  /** PATCH /api/usuarios/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const usuario = await usuarioService.cambiarEstado(req.idsValidados.id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: 'usuarios',
      accion: ACCION_BITACORA.EDICION,
      idRegistro: usuario.id,
      detalle: `Estado de ${usuario.email}: ahora "${usuario.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: usuario
    });
  });

  /** DELETE /api/usuarios/:id */
  eliminar = capturarAsync(async (req, res) => {
    const resumen = await usuarioService.eliminar(req.idsValidados.id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: 'usuarios',
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: resumen.id,
      detalle: `Usuario ${resumen.email} eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Usuario'),
      datos: resumen
    });
  });
}

// SINGLETON
module.exports = new UsuarioController();
