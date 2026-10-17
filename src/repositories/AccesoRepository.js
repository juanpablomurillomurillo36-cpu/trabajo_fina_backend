/**
 * src/repositories/AccesoRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de la tabla `accesos` (bitacora de login/logout).
 *
 * AQUI VIVE: el INSERT de cada intento de sesion y lecturas de
 * auditoria basicas.
 * NO VIVE: la decision de CUANDO registrar (eso es el auth.service)
 * ni la verificacion de credenciales.
 *
 * FILOSOFIA DE ESCRITURA
 * ---------------------------------------------------------------------
 * `registrar()` NUNCA lanza el error hacia arriba a proposito: si la
 * bitacora esta caida, el login NO debe fallar (el usuario puede
 * entrar; el registro del acceso se pierde y se asume). Un error de
 * auditoria no puede ser mas grave que el evento que se audita.
 * En su lugar devuelve false y el service puede loguearlo.
 */

const db = require('../config/database');
const { Acceso } = require('../models');

class AccesoRepository {
  /**
   * Graba un evento de bitacora.
   *
   * @param {Acceso} acceso
   * @returns {Promise<boolean>} false si no se pudo grabar (nunca throw).
   */
  async registrar(acceso) {
    try {
      const fila = acceso.aFilaBaseDatos();

      await db.ejecutar(
        `INSERT INTO accesos (id_usuario, tipo_accion, ip_origen, resultado)
         VALUES (?, ?, ?, ?)`,
        [fila.id_usuario, fila.tipo_accion, fila.ip_origen, fila.resultado]
      );

      return true;
    } catch (error) {
      // Se deja constancia en servidor; el cliente no debe enterarse.
      console.error('[accesos] No se pudo registrar el acceso:', error.message);
      return false;
    }
  }

  /**
   * Ultimos accesos de un usuario (auditoria rapida).
   *
   * @param {number} idUsuario
   * @param {number} [limite]
   * @returns {Promise<Acceso[]>}
   */
  async listarPorUsuario(idUsuario, limite = 20) {
    const filas = await db.ejecutar(
      `SELECT id_acceso, id_usuario, tipo_accion, fecha_hora, ip_origen, resultado
         FROM accesos
        WHERE id_usuario = ?
        ORDER BY fecha_hora DESC, id_acceso DESC
        LIMIT ?`,
      [idUsuario, limite]
    );

    return filas.map((fila) => Acceso.desdeFila(fila));
  }

  /**
   * Total de intentos FALLIDOS recientes de un usuario.
   *
   * Deja preparada la defensa contra fuerza bruta (varias claves
   * malas seguidas); la regla concreta de bloqueo se define en el
   * service cuando se necesite.
   *
   * @param {number} idUsuario
   * @param {number} [ventanaMinutos]
   * @returns {Promise<number>}
   */
  async contarFallidosRecientes(idUsuario, ventanaMinutos = 15) {
    const fila = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM accesos
        WHERE id_usuario = ?
          AND resultado = 'fallido'
          AND fecha_hora >= NOW() - INTERVAL ? MINUTE`,
      [idUsuario, ventanaMinutos]
    );

    return Number(fila?.total ?? 0);
  }
}

// SINGLETON
module.exports = new AccesoRepository();
