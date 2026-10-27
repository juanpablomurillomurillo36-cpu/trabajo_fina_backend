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
const fechas = require('../utils/fechas');
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

  /**
   * Traduce cada campo del body a su columna real.
   *
   * Se usa en el UPDATE DINAMICO: solo se escribe lo que llego, con el
   * nombre de columna correcto (y `contrasena` apunta al HASH, que es
   * lo unico que la base acepta).
   */
  #mapaColumnas = {
    nombre: 'nombre',
    apellido: 'apellido',
    email: 'email',
    telefono: 'telefono',
    idRol: 'id_rol',
    estado: 'estado',
    contrasena: 'contrasena_hash'
  };

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
   * @returns {Promise<Usuario>} El usuario creado, ya con su id y su
   *          fechaCreacion: se devuelve la INSTANCIA construida aqui,
   *          sin re-leer la fila (mismo estilo que el ejemplo).
   * @throws {AppError} 400 datos invalidos o rol inexistente,
   *                    409 correo ya registrado.
   */
  async crear(datos) {
    const entrada = soloCamposPermitidos(datos, this.#camposPermitidos);

    const datosNormalizados = this.#validar(entrada, { esCreacion: true });

    await this.#asegurarCorreoUnico(datosNormalizados.email, null);
    await this.#asegurarRolExistente(datosNormalizados.idRol);

    // hashearPassword es async (bcrypt trabaja fuera del hilo principal).
    const contrasenaHash = await cifrado.hashearPassword(datosNormalizados.contrasena);

    // 1. Instanciar el objeto del dominio. La clave en CLARO jamas
    //    llega al modelo: solo viaja su hash (Usuario.js lo exige).
    const usuario = Usuario.desdeJSON({
      idRol: datosNormalizados.idRol,
      nombre: datosNormalizados.nombre,
      apellido: datosNormalizados.apellido,
      email: datosNormalizados.email,
      telefono: datosNormalizados.telefono,
      estado: datosNormalizados.estado,
      contrasenaHash
    });

    // La fecha la pone el service (misma maquina que MySQL, cuyo
    // DEFAULT CURRENT_TIMESTAMP rellena la columna).
    usuario.fechaCreacion = fechas.ahoraISO();

    // 2. Persistir: aFilaBaseDatos() traduce el objeto a columnas.
    const fila = usuario.aFilaBaseDatos();

    const resultado = await db.ejecutar(
      `INSERT INTO usuarios
         (id_rol, nombre, apellido, email, contrasena_hash, telefono, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fila.id_rol,
        fila.nombre,
        fila.apellido,
        fila.email,
        fila.contrasena_hash,
        fila.telefono,
        fila.estado
      ]
    );

    // MySQL nos devuelve el id que genero el AUTO_INCREMENT.
    // Lo asignamos POR EL SETTER, no tocando el atributo privado.
    usuario.id = resultado.insertId;

    // Se devuelve la instancia creada (sin re-leer), igual que el
    // proyecto de ejemplo del profesor.
    return usuario;
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
    // 1. Verificar que exista. Si no, obtenerPorId lanza el 404.
    const usuario = await this.obtenerPorId(id);

    const entrada = soloCamposPermitidos(datos, this.#camposPermitidos);

    if (Object.keys(entrada).length === 0) {
      throw AppError.cuerpoInvalido(
        'La peticion no incluye ningun campo actualizable. Se admiten: ' +
          this.#camposPermitidos.join(', ')
      );
    }

    // 2. Normalizar y validar el conjunto COMPLETO (lo que llego mas
    //    lo que ya existia), para que ninguna validacion vea campos
    //    vacios.
    const esCreacion = false;
    const normalizados = this.#validar(
      {
        nombre: entrada.nombre ?? usuario.nombre,
        apellido: entrada.apellido ?? usuario.apellido,
        email: entrada.email ?? usuario.email,
        telefono: entrada.telefono ?? usuario.telefono,
        idRol: entrada.idRol ?? usuario.idRol,
        estado: entrada.estado ?? usuario.estado,
        // La contrasena solo se valida si viene: un PUT que no la
        // trae no debe exigir la regla de 8 caracteres.
        contrasena: entrada.contrasena
      },
      { esCreacion, traeContrasena: entrada.contrasena !== undefined }
    );

    if (entrada.email !== undefined && normalizados.email !== usuario.email) {
      await this.#asegurarCorreoUnico(normalizados.email, id);
    }

    if (entrada.idRol !== undefined) {
      await this.#asegurarRolExistente(normalizados.idRol);
    }

    // 3. Aplicar los cambios AL OBJETO usando sus SETTERS. Solo se
    //    tocan los campos que llegaron: el resto conserva el valor de
    //    la fila.
    if (entrada.contrasena !== undefined) {
      // Se guarda el HASH, nunca la clave en claro.
      usuario.contrasenaHash = await cifrado.hashearPassword(normalizados.contrasena);
    }

    for (const campo of Object.keys(entrada)) {
      if (campo === 'contrasena') continue; // ya aplicada como hash
      usuario[campo] = normalizados[campo];
    }

    // 4. UPDATE DINAMICO: solo las columnas que efectivamente
    //    cambiaron, con sus valores salidos de aFilaBaseDatos().
    //    Si la contrasena vino, su hash entra en el MISMO UPDATE.
    const fila = usuario.aFilaBaseDatos();
    const asignaciones = [];
    const parametros = [];

    for (const campo of Object.keys(entrada)) {
      const columna = this.#mapaColumnas[campo];
      if (!columna) continue;

      asignaciones.push(`${columna} = ?`);
      parametros.push(fila[columna]);
    }

    if (asignaciones.length > 0) {
      parametros.push(id);

      await db.ejecutar(
        `UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id_usuario = ?`,
        parametros
      );
    }

    // Se relee al final, igual que el proyecto de ejemplo: asi la
    // respuesta refleja lo que quedo realmente guardado en la base.
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
   * @returns {Promise<Usuario>} La MISMA instancia con el estado ya
   *          cambiado (no se re-lee la fila), como en el ejemplo.
   */
  async cambiarEstado(id, estado) {
    const usuario = await this.obtenerPorId(id);

    const errores = new ColectorErrores();
    errores.exigirValorDeLista('estado', estado, Object.values(ESTADO));
    errores.lanzarSiHayErrores();

    // El objeto decide como representar su propio estado.
    if (estado === ESTADO.ACTIVO) {
      usuario.activar();
    } else {
      usuario.desactivar();
    }

    await db.ejecutar('UPDATE usuarios SET estado = ? WHERE id_usuario = ?', [
      usuario.estado,
      id
    ]);

    return usuario;
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
   * @returns {Promise<object>} Resumen en el MISMO estilo que el
   *          ejemplo: llave `id` y sin campo `mensaje`.
   */
  async eliminar(id) {
    const existente = await this.obtenerPorId(id);

    await db.ejecutar('DELETE FROM usuarios WHERE id_usuario = ?', [id]);

    return {
      id: existente.id,
      nombreCompleto: existente.nombreCompleto,
      email: existente.email
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
