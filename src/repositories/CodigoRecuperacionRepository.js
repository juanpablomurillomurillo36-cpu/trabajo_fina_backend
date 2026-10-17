/**
 * src/repositories/CodigoRecuperacionRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de la tabla `codigos_recuperacion` (olvide mi
 * contrasena).
 *
 * AQUI VIVE: el ciclo de vida del codigo:
 *   crear -> verificar (con conteo de intentos) -> marcar usado.
 * NO VIVE: generar el codigo, hashearlo ni decidir respuestas HTTP
 *          (eso es el auth.service).
 *
 * SEGURIDAD QUE IMPLEMENTA ESTE ARCHIVO
 * ---------------------------------------------------------------------
 *   - Solo se guardan BUSQUEDAS por hash: el codigo en claro se genera
 *     y compara FUERA de la base; aqui unicamente pasa el hash bcrypt.
 *   - `marcarComoUsado` es monotono: un codigo viejo jamas vuelve a
 *     quedar activo.
 *   - Los codigos viejos de un usuario se invalidan al crear uno nuevo
 *     (solo existe UN codigo activo por cuenta, evita que un codigo
 *     "olvidado" siga siendo valido tras pedir uno nuevo).
 */

const db = require('../config/database');

class CodigoRecuperacionRepository {
  /**
   * Invalida todos los codigos PENDIENTES del usuario.
   *
   * Se llama ANTES de emitir uno nuevo: si un usuario pide recuperacion
   * 5 veces, los 4 codigos anteriores dejan de servir. Asi un codigo
   * robado (de un correo viejo) no sobrevive a un pedido posterior.
   *
   * @param {number} idUsuario
   * @returns {Promise<number>} cuantos se invalidaron.
   */
  async invalidarPendientes(idUsuario) {
    const resultado = await db.ejecutar(
      `UPDATE codigos_recuperacion
          SET usado = 1
        WHERE id_usuario = ?
          AND usado = 0`,
      [idUsuario]
    );

    return resultado.affectedRows;
  }

  /**
   * Guarda el hash del codigo recien generado.
   *
   * @param {object} datos
   * @param {number}   datos.idUsuario
   * @param {string}   datos.codigoHash     bcrypt del codigo.
   * @param {string}   datos.fechaExpiracion 'YYYY-MM-DD HH:MM:SS' (15 min).
   * @returns {Promise<number>} id del codigo.
   */
  async crear({ idUsuario, codigoHash, fechaExpiracion }) {
    const resultado = await db.ejecutar(
      `INSERT INTO codigos_recuperacion (id_usuario, codigo_hash, fecha_expiracion)
       VALUES (?, ?, ?)`,
      [idUsuario, codigoHash, fechaExpiracion]
    );

    return resultado.insertId;
  }

  /**
   * El codigo PENDIENTE y NO VENCIDO mas reciente del usuario.
   *
   * El filtro se hace aqui mismo (usado=0 y fecha futura) para que
   * el service no tenga que interpretar estados: o hay un codigo
   * utilizable, o devuelve null.
   *
   * @param {number} idUsuario
   * @returns {Promise<{idCodigo: number, codigoHash: string, fechaExpiracion: string, intentos: number}|null>}
   */
  async obtenerActivo(idUsuario) {
    const fila = await db.obtenerUno(
      `SELECT id_codigo, codigo_hash, fecha_expiracion, intentos
         FROM codigos_recuperacion
        WHERE id_usuario = ?
          AND usado = 0
          AND fecha_expiracion > NOW()
        ORDER BY id_codigo DESC
        LIMIT 1`,
      [idUsuario]
    );

    if (fila === null) return null;

    return {
      idCodigo: fila.id_codigo,
      codigoHash: fila.codigo_hash,
      fechaExpiracion: fila.fecha_expiracion,
      intentos: Number(fila.intentos)
    };
  }

  /**
   * Registra un intento fallido de verificacion.
   *
   * El tope (5) se evalua en el service: aqui solo se acumula el
   * contador para que el limite sea visible en la base.
   *
   * @param {number} idCodigo
   * @returns {Promise<number>} intentos acumulados tras el incremento.
   */
  async sumarIntento(idCodigo) {
    const resultado = await db.ejecutar(
      `UPDATE codigos_recuperacion
          SET intentos = intentos + 1
        WHERE id_codigo = ?`,
      [idCodigo]
    );

    if (resultado.affectedRows === 0) return 0;

    const fila = await db.obtenerUno(
      `SELECT intentos FROM codigos_recuperacion WHERE id_codigo = ?`,
      [idCodigo]
    );

    return Number(fila?.intentos ?? 0);
  }

  /**
   * Marca el codigo como intercambiado (ya no sirve para nada).
   *
   * @param {number} idCodigo
   * @returns {Promise<boolean>}
   */
  async marcarComoUsado(idCodigo) {
    const resultado = await db.ejecutar(
      `UPDATE codigos_recuperacion
          SET usado = 1
        WHERE id_codigo = ?`,
      [idCodigo]
    );

    return resultado.affectedRows > 0;
  }

  /**
   * Borra codigos VENCIDOS de todos los usuarios (mantenimiento).
   *
   * Opcional: la consulta de `obtenerActivo` ya ignora los vencidos;
   * esta limpieza evita que la tabla crezca sin limite con el tiempo.
   *
   * @returns {Promise<number>} cuantos se borraron.
   */
  async limpiarVencidos() {
    const resultado = await db.ejecutar(
      `DELETE FROM codigos_recuperacion
        WHERE fecha_expiracion < NOW() - INTERVAL 7 DAY`,
      []
    );

    return resultado.affectedRows;
  }
}

// SINGLETON
module.exports = new CodigoRecuperacionRepository();
