/**
 * src/repositories/BitacoraRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de la tabla `bitacora` (auditoria de cambios).
 *
 * AQUI VIVE: el INSERT de cada evento y el listado paginado con
 * filtros. NO VIVE: decidir QUE auditar (los services/controladores
 * dicen "esto cambio"; aqui solo se graba y se lee).
 *
 * FILOSOFIA DE ESCRITURA (igual que AccesoRepository)
 * ---------------------------------------------------------------------
 * `registrar()` NUNCA propaga el error: si la auditoria falla, la
 * OPERACION REAL ya se hizo y no se puede deshacer por un fallo de
 * registro. Se imprime en consola y se devuelve false. La brecha de
 * auditoria queda visible para el operador, pero el usuario no ve un
 * 500 por algo que no es su culpa.
 */

const db = require('../config/database');
const { Bitacora } = require('../models');
const { Filtros, aLimites } = require('../utils/consulta');

class BitacoraRepository {
  /**
   * Graba un evento de auditoria.
   *
   * @param {Bitacora} evento
   * @returns {Promise<boolean>} false si no se pudo grabar (nunca throw).
   */
  async registrar(evento) {
    try {
      const fila = evento.aFilaBaseDatos();

      await db.ejecutar(
        `INSERT INTO bitacora (id_usuario, tabla, id_registro, accion, detalle, direccion_ip)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fila.id_usuario, fila.tabla, fila.id_registro, fila.accion, fila.detalle, fila.direccion_ip]
      );

      return true;
    } catch (error) {
      console.error('[bitacora] No se pudo registrar el evento:', error.message);
      return false;
    }
  }

  /**
   * Listado paginado con filtros opcionales.
   *
   * El JOIN con usuarios trae el nombre de QUIEN hizo la accion para
   * que el listado sea legible sin una segunda consulta.
   *
   * @param {object}   opciones
   * @param {string}   [opciones.tabla]      'usuarios', 'roles', ...
   * @param {string}   [opciones.accion]     'CREACION' | 'EDICION' | 'ANULACION'
   * @param {number}   [opciones.idUsuario]  Quien lo hizo.
   * @param {number}   [opciones.pagina]
   * @param {number}   [opciones.limite]
   * @returns {Promise<{ eventos: Bitacora[], total: number }>}
   */
  async listar({ tabla = null, accion = null, idUsuario = null, pagina = 1, limite = 20 } = {}) {
    const filtros = new Filtros();

    filtros
      .agregarSi(tabla, 'b.tabla = ?', tabla)
      .agregarSi(accion, 'b.accion = ?', accion)
      .agregarSi(idUsuario, 'b.id_usuario = ?', idUsuario);

    const where = filtros.obtenerWhere();
    const parametros = filtros.obtenerParametros();
    const { limite: porPagina, offset } = aLimites(pagina, limite);

    const [total, filas] = await Promise.all([
      this.#contar(where, parametros),
      db.ejecutar(
        `SELECT b.id_bitacora, b.id_usuario, b.tabla, b.id_registro,
                b.accion, b.detalle, b.direccion_ip, b.fecha_hora,
                CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario
           FROM bitacora b
           JOIN usuarios u ON u.id_usuario = b.id_usuario
           ${where}
          ORDER BY b.fecha_hora DESC, b.id_bitacora DESC
          LIMIT ? OFFSET ?`,
        [...parametros, porPagina, offset]
      )
    ]);

    return {
      eventos: filas.map((fila) => Bitacora.desdeFila(fila)),
      total
    };
  }

  /**
   * Historial de UN registro puntual (ej. "la venta 42").
   *
   * Deja listo el endpoint de detalle historico que la rúbrica
   * describe como uso tipico del indice (tabla, id_registro).
   *
   * @param {string} tabla
   * @param {number} idRegistro
   * @returns {Promise<Bitacora[]>}
   */
  async listarDeRegistro(tabla, idRegistro) {
    const filas = await db.ejecutar(
      `SELECT b.id_bitacora, b.id_usuario, b.tabla, b.id_registro,
              b.accion, b.detalle, b.direccion_ip, b.fecha_hora,
              CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario
         FROM bitacora b
         JOIN usuarios u ON u.id_usuario = b.id_usuario
        WHERE b.tabla = ? AND b.id_registro = ?
        ORDER BY b.fecha_hora DESC, b.id_bitacora DESC
        LIMIT 50`,
      [tabla, idRegistro]
    );

    return filas.map((fila) => Bitacora.desdeFila(fila));
  }

  // ------------------------------------------------------------------
  // Privadas
  // ------------------------------------------------------------------

  /**
   * @param {string} where
   * @param {Array}  parametros
   * @returns {Promise<number>}
   */
  async #contar(where, parametros) {
    const fila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM bitacora b ${where}`,
      parametros
    );

    return Number(fila?.total ?? 0);
  }
}

// SINGLETON
module.exports = new BitacoraRepository();
