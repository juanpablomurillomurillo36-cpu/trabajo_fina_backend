/**
 * src/controllers/permiso.controller.js
 * ---------------------------------------------------------------------
 * CAPA DE CONTROLADOR de la entidad Permiso.
 *
 * SU UNICA RESPONSABILIDAD: traducir entre HTTP y el servicio.
 *
 *   ENTRADA : saca los datos de req (params, query, body).
 *   DELEGA  : llama al service, que es quien sabe las reglas.
 *   SALIDA  : arma la respuesta HTTP con el codigo correcto.
 *
 * REGLA PARA RECONOCER UN CONTROLADOR BIEN HECHO:
 * No debe contener NI UNA consulta SQL, NI UNA validacion de negocio,
 * NI UN calculo. Si ves un `SELECT` o un `if (nombre === '')` aqui,
 * esa logica esta en la capa equivocada.
 *
 * Cada metodo se envuelve en capturarAsync: si el service lanza un
 * AppError (400, 404, 409...), el error viaja solo hasta el manejador
 * central. POR ESO NO HAY NI UN try/catch EN ESTE ARCHIVO.
 *
 * DE DONDE SALEN LOS DATOS DE LA PETICION?
 *   req.params -> de la ruta        /api/permisos/7     -> { id: '7' }
 *   req.query  -> de la query       ?pagina=2&estado=activo
 *   req.body   -> del cuerpo JSON   { "nombrePermiso": ... }
 *
 * OJO: req.params y req.query SIEMPRE traen TEXTO. El middleware
 * validarIdNumerico ya dejo el id convertido en req.idsValidados.
 */

const permisoService = require('../services/permiso.service');
const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const { capturarAsync } = require('../middleware/errorHandler');

class PermisoController {
  /**
   * GET /api/permisos
   * Lista permisos con filtros y paginacion.
   *
   * Query admitida: ?pagina=1&limite=20&estado=activo&busqueda=roles
   */
  listar = capturarAsync(async (req, res) => {
    // Le pasamos la query completa al service; el decide que usar.
    const { permisos, total, pagina, limite } = await permisoService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('permisos'),

      // permisos es un arreglo de objetos Permiso. Al serializar,
      // JSON.stringify llama al toJSON() de cada uno automatico.
      datos: permisos,

      meta: respuesta.construirMeta({
        total,
        pagina,
        limite,
        devueltos: permisos.length
      })
    });
  });

  /**
   * GET /api/permisos/:id
   * Devuelve un permiso.
   */
  obtener = capturarAsync(async (req, res) => {
    // El id ya viene validado y convertido a numero por el middleware.
    const id = req.idsValidados.id;

    const permiso = await permisoService.obtenerPorId(id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Permiso'),
      datos: permiso
    });
  });

  /**
   * POST /api/permisos
   * Crea un permiso nuevo.
   *
   * Responde 201 Created y no 200: es el codigo correcto cuando la
   * peticion crea un recurso nuevo en el servidor.
   */
  crear = capturarAsync(async (req, res) => {
    const permiso = await permisoService.crear(req.body);

    // Cabecera Location: le dice al cliente en que URL quedo el
    // recurso recien creado. Es parte del estandar REST (C4).
    res.set('Location', `/api/permisos/${permiso.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Permiso'),
      datos: permiso
    });
  });

  /**
   * PUT /api/permisos/:id
   * Actualiza un permiso (tambien admite campos parciales).
   */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;

    const permiso = await permisoService.actualizar(id, req.body);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Permiso'),
      datos: permiso
    });
  });

  /**
   * PATCH /api/permisos/:id/estado
   * Cambia unicamente el estado (activo / inactivo).
   *
   * Se usa PATCH y no PUT porque la operacion modifica UNA parte del
   * recurso, no todo. Esa es la diferencia entre ambos verbos.
   */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;

    const permiso = await permisoService.cambiarEstado(id, req.body);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: permiso
    });
  });

  /**
   * DELETE /api/permisos/:id
   * Elimina el permiso si no esta asignado a ningun rol.
   *
   * Devolvemos 200 con un resumen en lugar de 204 (sin contenido),
   * porque al usuario le sirve VER que se borro.
   */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;

    const resumen = await permisoService.eliminar(id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Permiso'),
      datos: resumen
    });
  });
}

// SINGLETON: el controller se exporta como instancia, igual que el
// service y el repository.
module.exports = new PermisoController();
