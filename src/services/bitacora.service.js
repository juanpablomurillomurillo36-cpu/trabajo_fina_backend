/**
 * src/services/bitacora.service.js
 * ---------------------------------------------------------------------
 * CAPA DE SERVICIO de la BITACORA (auditoria de datos).
 *
 * DOS RESPONSABILIDADES
 *   1. `registrarDesdeReq` -> convertir una peticion HTTP + un cambio
 *      en un evento de auditoria, SIN que los demais services tengan
 *      que conocer HTTP ni req.
 *   2. `listar` -> consulta paginada para el panel de auditoria.
 *
 * COMO SE USA EN UN CONTROLADOR (patron unico en el proyecto)
 * ---------------------------------------------------------------------
 *   const rol = await rolService.crear(req.body);
 *   await bitacoraService.registrarDesdeReq(req, {
 *     tabla: 'roles',
 *     accion: ACCION_BITACORA.CREACION,
 *     idRegistro: rol.id,
 *     detalle: `Rol "${rol.nombreRol}" creado`
 *   });
 *
 * El controlador DECIDE que cambio (es el que sabe que fue una
 * CREACION); el service RESUELVE quien fue (req.usuario) y con que IP.
 *
 * POR QUE NO FALLA SI NO HAY SESION?
 * La bitacora de un cambio sin autenticacion no tiene "quien": en vez
 * de romper la operacion, se omite el evento. Con las rutas protegidas
 * (fase 22) esto solo pasa si alguien olvida el middleware, y el
 * silencio es mejor que un 500 en plena creacion.
 */

const { Bitacora } = require('../models');
const { LIMITES } = require('../utils/constants');
const formato = require('../utils/formato');
const bitacoraRepository = require('../repositories/BitacoraRepository');

class BitacoraService {
  /**
   * Registra el evento que describe la peticion actual.
   *
   * @param {object} req      Peticion HTTP (req.usuario + req.ip).
   * @param {object} evento
   * @param {string}   evento.tabla       Tabla afectada.
   * @param {string}   evento.accion      ACCION_BITACORA.*
   * @param {number}   [evento.idRegistro]
   * @param {string}   [evento.detalle]
   * @returns {Promise<boolean>} false si no hubo quien registrar.
   */
  async registrarDesdeReq(req, { tabla, accion, idRegistro = null, detalle = null }) {
    const idUsuario = req?.usuario?.id;

    if (!idUsuario) {
      return false;
    }

    return bitacoraRepository.registrar(
      Bitacora.desdeJSON({
        idUsuario,
        tabla,
        accion,
        idRegistro,
        // req.ip puede traer "::1" (IPv6 local) o "127.0.0.1";
        // la columna admite 45 caracteres (tamanio maximo IPv6).
        direccionIp: formato.limpiarTexto(req.ip),
        detalle
      })
    );
  }

  /**
   * Listado paginado de eventos de auditoria.
   *
   * @param {object} filtros  req.query
   * @returns {Promise<{eventos: Bitacora[], total: number, pagina: number, limite: number}>}
   */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const tabla = formato.limpiarTexto(filtros.tabla);
    const accion = formato.limpiarTexto(filtros.accion);
    const idUsuario = formato.aEnteroONulo(filtros.idUsuario);

    const { eventos, total } = await bitacoraRepository.listar({
      tabla,
      accion,
      idUsuario,
      pagina,
      limite
    });

    return { eventos, total, pagina, limite };
  }

  /**
   * Historial de UN registro puntual.
   *
   * @param {string} tabla
   * @param {number} idRegistro
   * @returns {Promise<Bitacora[]>}
   */
  async listarDeRegistro(tabla, idRegistro) {
    return bitacoraRepository.listarDeRegistro(tabla, idRegistro);
  }
}

// SINGLETON
module.exports = new BitacoraService();
