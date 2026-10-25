/**
 * src/services/usuario.service.js
 * ---------------------------------------------------------------------
 * CAPA DE SERVICE de la entidad Usuario.
 *
 * REGLA #1 DE ESTE ARCHIVO: la contrasena NUNCA viaja en claro.
 *   - Se RECIBE en claro desde el cliente (HTTPS se encarga del
 *     transporte).
 *   - Se GUARDA hasheada con bcrypt (utils/cifrado.js).
 *   - Se NUNCA se lee en los SELECT de listado ni se expone en
 *     toJSON(); por eso las consultas de abajo NO piden la columna
 *     contrasena_hash: si no se pide, no puede filtrarse por accidente.
 *
 * TABLA `usuarios`
 * ---------------------------------------------------------------------
 *   id_usuario      INT PK AUTO_INCREMENT
 *   id_rol          INT NOT NULL  -> FK roles.id_rol
 *   nombre          VARCHAR(80) NOT NULL
 *   apellido        VARCHAR(80) NOT NULL
 *   email           VARCHAR(120) NOT NULL UNIQUE
 *   contrasena_hash VARCHAR(255) NOT NULL
 *   telefono        VARCHAR(20) NULL
 *   estado          ENUM('activo','inactivo') DEFAULT 'activo'
 *   fecha_creacion  DATETIME DEFAULT CURRENT_TIMESTAMP
 */

const db = require('../config/database');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const { Usuario } = require('../models');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES } = require('../utils/constants');
const cifrado = require('../utils/cifrado');
const {
  limpiarTexto,
  soloCamposPermitidos,
  normalizarPaginacion
} = require('../utils/formato');

/**
 * Columnas del usuario. OJO: NO esta `contrasena_hash` a proposito.
 * Ninguna lectura de esta capa necesita el hash, y no pedirlo es la
 * forma mas barata de garantizar que no se filtre.
 */
const COLUMNAS_USUARIO = `
  u.id_usuario, u.id_rol, u.nombre, u.apellido, u.email,
  u.telefono, u.estado, u.fecha_creacion, r.nombre_rol`;

class UsuarioService {
  #camposPermitidos = ['nombre', 'apellido', 'email', 'telefono', 'idRol', 'estado', 'contrasena'];

  // =================================================================
  // LISTADO
  // ================================================================

  /**
   * Lista usuarios con filtros, paginacion y el nombre del rol.
   *
   * Filtros: ?estado=activo & busqueda=ana & idRol=5 & pagina=1 & limite=20
   *
   * INNER JOIN con roles: como id_rol es NOT NULL y tiene llave
   * foranea, no puede haber usuarios "sin rol"; por eso el join
   * interno no pierde ninguna fila.
   *
   * @param {object} filtros
   * @returns {Promise<{usuarios: Usuario[], total: number, pagina: number, limite: number}>}
   */
  async listar(filtros = {}) {
    const { pagina, limite, desplazamiento } = normalizarPaginacion(
      filtros,
      LIMITES.LIMITE_DEFECTO,
      LIMITES.LIMITE_PAGINA
    );

    const condiciones = [];
    const parametros = [];

    if (filtros.estado) {
      const estado = limpiarTexto(String(filtros.estado));

      if (Object.values(ESTADO).includes(estado)) {
        condiciones.push('u.estado = ?');
        parametros.push(estado);
      }
    }

    // Filtro por rol: si manda algo que no sea entero, se ignora en
    // vez de romper la consulta con un 400 por algo tan blando.
    const idRol = Number.parseInt(filtros.idRol, 10);

    if (Number.isInteger(idRol) && idRol > 0) {
      condiciones.push('u.id_rol = ?');
      parametros.push(idRol);
    }

    if (filtros.busqueda && limpiarTexto(String(filtros.busqueda)) !== '') {
      const texto = limpiarTexto(String(filtros.busqueda));
      const patron = `%${texto.replace(/[%_]/g, '\\$&')}%`;

      condiciones.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ?)');
      parametros.push(patron, patron, patron);
    }

    const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const filaTotal = await db.obtenerUno(
      `SELECT COUNT(*) AS total
         FROM usuarios u
         INNER JOIN roles r ON r.id_rol = u.id_rol
         ${donde}`,
      parametros
    );
    const total = Number(filaTotal?.total ?? 0);

    const filas = await db.ejecutar(
      `SELECT ${COLUMNAS_USUARIO}
         FROM usuarios u
         INNER JOIN roles r ON r.id_rol = u.id_rol
         ${donde}
        ORDER BY u.apellido, u.nombre
        LIMIT ${limite} OFFSET ${desplazamiento}`,
      parametros
    );

    return {
      usuarios: filas.map((fila) => Usuario.desdeFila(fila)),
      total,
      pagina,
      limite
    };
  }

  // =================================================================
  // DETALLE
  // ================================================================

  /**
   * Busca un usuario por id, con el nombre de su rol.
   *
   * @param {number} id
   * @returns {Promise<Usuario>}
   * @throws {AppError} 404 si no existe.
   */
  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      `SELECT ${COLUMNAS_USUARIO}
         FROM usuarios u
         INNER JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = ?`,
      [id]
    );

    if (fila === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.USUARIO_NO_EXISTE(id));
    }

    return Usuario.desdeFila(fila);
  }

  // =================================================================
  // CREACION
  // ================================================================

  /**
   * Crea un usuario.
   *
   * Orden de las validaciones: primero lo BARATO (formato) y despues
   * lo que cuesta una consulta (unicidad, existencia del rol). Asi,
   * si el formato esta mal no se gasta un viaje a la base.
   *
   * @param {object} datos  req.body.
   * @returns {Promise<Usuario>}
   * @throws {AppError} 400 datos invalidos o rol inexistente,
   *                    409 correo ya registrado.
   */
  async crear(datos) {
    const entrada = soloCamposPermitidos(datos, this.#camposPermitidos);

    const datosNormalizados = this.#validar(entrada, { esCreacion: true });

    await this.#asegurarCorreoUnico(datosNormalizados.email, null);
    await this.#asegurarRolExistente(datosNormalizados.idRol);

    // hashearPassword es async (bcrypt trabaja fuera del hilo principal).
    datosNormalizados.contrasenaHash = await cifrado.hashearPassword(
      datosNormalizados.contrasena
    );

    const resultado = await db.ejecutar(
      `INSERT INTO usuarios
         (id_rol, nombre, apellido, email, contrasena_hash, telefono, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        datosNormalizados.idRol,
        datosNormalizados.nombre,
        datosNormalizados.apellido,
        datosNormalizados.email,
        datosNormalizados.contrasenaHash,
        datosNormalizados.telefono,
        datosNormalizados.estado
      ]
    );

    return this.obtenerPorId(resultado.insertId);
  }

  // =================================================================
  // ACTUALIZACION
  // ================================================================

  /**
   * Actualizacion PARCIAL del usuario.
   *
   * Caso real de la coleccion de Postman: el PUT manda UNICAMENTE
   * {"telefono": "3001112233"}. Todo lo demas tiene que quedar igual;
   * si se hiciera un UPDATE con solo ese campo y los demas llegaran
   * vacios, se borrarian nombre y apellido.
   *
   * @param {number} id
   * @param {object} datos
   * @returns {Promise<Usuario>}
   */
  async actualizar(id, datos) {
    const existente = await this.obtenerPorId(id);

    const entrada = soloCamposPermitidos(datos, this.#camposPermitidos);

    if (Object.keys(entrada).length === 0) {
      throw AppError.cuerpoInvalido(
        'La peticion no incluye ningun campo actualizable. Se admiten: ' +
          this.#camposPermitidos.join(', ')
      );
    }

    const esCreacion = false;
    const datosNormalizados = this.#validar(
      {
        nombre: entrada.nombre ?? existente.nombre,
        apellido: entrada.apellido ?? existente.apellido,
        email: entrada.email ?? existente.email,
        telefono: entrada.telefono ?? existente.telefono,
        idRol: entrada.idRol ?? existente.idRol,
        estado: entrada.estado ?? existente.estado,
        // La contrasena solo se valida si viene: un PUT que no la
        // trae no debe exigir la regla de 8 caracteres.
        contrasena: entrada.contrasena
      },
      { esCreacion, traeContrasena: entrada.contrasena !== undefined }
    );

    if (entrada.email !== undefined && datosNormalizados.email !== existente.email) {
      await this.#asegurarCorreoUnico(datosNormalizados.email, id);
    }

    if (entrada.idRol !== undefined) {
      await this.#asegurarRolExistente(datosNormalizados.idRol);
    }

    await db.ejecutar(
      `UPDATE usuarios
          SET id_rol = ?, nombre = ?, apellido = ?, email = ?, telefono = ?, estado = ?
        WHERE id_usuario = ?`,
      [
        datosNormalizados.idRol,
        datosNormalizados.nombre,
        datosNormalizados.apellido,
        datosNormalizados.email,
        datosNormalizados.telefono,
        datosNormalizados.estado,
        id
      ]
    );

    // La contrasena se UPDATEA aparte, con su propio hash, para no
    // arrastrar la columna contrasena_hash en cada PUT normal.
    if (datosNormalizados.contrasena) {
      const hash = await cifrado.hashearPassword(datosNormalizados.contrasena);

      await db.ejecutar('UPDATE usuarios SET contrasena_hash = ? WHERE id_usuario = ?', [
        hash,
        id
      ]);
    }

    return this.obtenerPorId(id);
  }

  // =================================================================
  // CAMBIO DE ESTADO (PATCH)
  // ================================================================

  /**
   * Baja o subida logica del usuario (no se borra la cuenta).
   *
   * @param {number} id
   * @param {string} estado
   * @returns {Promise<Usuario>}
   */
  async cambiarEstado(id, estado) {
    await this.obtenerPorId(id);

    const errores = new ColectorErrores();
    errores.exigirValorDeLista('estado', estado, Object.values(ESTADO));
    errores.lanzarSiHayErrores();

    await db.ejecutar('UPDATE usuarios SET estado = ? WHERE id_usuario = ?', [estado, id]);

    return this.obtenerPorId(id);
  }

  // =================================================================
  // ELIMINACION
  // ================================================================

  /**
   * Elimina un usuario.
   *
   * El borrado puede fallar con 409 si el usuario tiene historial en
   * tablas que SÍ protegen su llave foranea (accesos, bitacora,
   * ingresos). En ese caso MySQL devuelve ER_ROW_IS_REFERENCED y el
   * middleware lo traduce a 409 con un mensaje claro.
   *
   * @param {number} id
   * @returns {Promise<object>}
   */
  async eliminar(id) {
    const existente = await this.obtenerPorId(id);

    await db.ejecutar('DELETE FROM usuarios WHERE id_usuario = ?', [id]);

    return {
      idEliminado: existente.id,
      email: existente.email,
      mensaje: 'Usuario eliminado'
    };
  }

  // =================================================================
  // METODOS PRIVADOS DE APOYO
  // ================================================================

  /**
   * Valida y normaliza todos los campos de un usuario.
   *
   * Devuelve un objeto plano listo para el SQL (no un Usuario): aqui
   * conviven textos normalizados, idRol ya convertido y, si vino,
   * la contrasena en CLARO (que despues se hashea; jamas se guarda).
   *
   * @param {object} entrada
   * @param {object} opciones
   * @param {boolean} opciones.esCreacion      La contrasena es obligatoria.
   * @param {boolean} opciones.traeContrasena  El PUT trajo contrasena.
   * @returns {object}
   * @throws {AppError} 400 con el detalle campo a campo.
   */
  #validar(entrada, { esCreacion = false, traeContrasena = false } = {}) {
    const errores = new ColectorErrores();

    errores.exigirTexto('nombre', entrada.nombre, { maximo: LIMITES.NOMBRE_USUARIO });
    errores.exigirTexto('apellido', entrada.apellido, { maximo: LIMITES.NOMBRE_USUARIO });
    errores.exigirCorreo('email', entrada.email);

    errores.exigirTexto('telefono', entrada.telefono, {
      maximo: LIMITES.TELEFONO,
      requerido: false
    });

    errores.exigirEntero('idRol', entrada.idRol, { minimo: 1 });

    if (entrada.estado !== undefined && entrada.estado !== null && entrada.estado !== '') {
      errores.exigirValorDeLista('estado', entrada.estado, Object.values(ESTADO));
    }

    const exigeContrasena = esCreacion || traeContrasena;

    if (exigeContrasena) {
      errores.exigirContrasena('contrasena', entrada.contrasena, esCreacion);
    }

    errores.lanzarSiHayErrores();

    return {
      nombre: limpiarTexto(entrada.nombre),
      apellido: limpiarTexto(entrada.apellido),
      email: limpiarTexto(entrada.email).toLowerCase(),
      telefono: entrada.telefono === undefined || entrada.telefono === null
        ? null
        : limpiarTexto(entrada.telefono),
      idRol: Number(entrada.idRol),
      estado: entrada.estado || ESTADO.ACTIVO,
      contrasena: exigeContrasena ? entrada.contrasena : null
    };
  }

  /**
   * Comprueba que el correo no este tomado.
   *
   * @param {string} email
   * @param {number|null} idExcluido  El propio id en un PUT.
   * @throws {AppError} 409 si ya existe.
   */
  async #asegurarCorreoUnico(email, idExcluido) {
    const fila = await db.obtenerUno(
      'SELECT id_usuario FROM usuarios WHERE email = ? AND id_usuario <> ?',
      [email, idExcluido ?? -1]
    );

    if (fila !== null) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.CORREO_DUPLICADO(email));
    }
  }

  /**
   * Comprueba que el rol exista ANTES de escribir.
   *
   * Es una consulta mas, pero evita dos cosas malas:
   *   - un 400 generico de MySQL (ER_NO_REFERENCED_ROW), y
   *   - dejar al usuario con un id_rol que no apunta a nada.
   *
   * @param {number} idRol
   * @throws {AppError} 400 si el rol no existe.
   */
  async #asegurarRolExistente(idRol) {
    const fila = await db.obtenerUno('SELECT id_rol FROM roles WHERE id_rol = ?', [idRol]);

    if (fila === null) {
      throw AppError.validacion(MENSAJES.NEGOCIO.ROL_INVALIDO(idRol), [
        { campo: 'idRol', mensaje: MENSAJES.NEGOCIO.ROL_INVALIDO(idRol) }
      ]);
    }
  }
}

module.exports = new UsuarioService();
