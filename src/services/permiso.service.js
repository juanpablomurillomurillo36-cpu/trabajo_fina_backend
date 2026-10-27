/**
 * src/services/permiso.service.js
 * ---------------------------------------------------------------------
 * CAPA DE SERVICE de la entidad Permiso.
 *
 * QUE VIVE AQUI (y que NO)?
 *   SI viven: las reglas de negocio, la validacion de los datos que
 *   llegan del cliente, y TODAS las consultas SQL.
 *   NO viven: HTTP (no hay `req`, no hay `res`, no hay codigos 200) ni
 *   los modelos de las 26 tablas. Esta capa no sabe que es una
 *   peticion web: podria ser llamada desde un script o desde un job
 *   programado y funcionaria igual.
 *
 * POR QUE NO HAY UNA CAPA "REPOSITORY" EN MEDIO?
 * Porque en este proyecto la persistencia y la regla de negocio estan
 * juntas a proposito. Separarlas obliga a escribir dos archivos por
 * entidad sin aportar nada mientras la logica sea simple; si la
 * entidad crece, la separacion se hace sin tocar los controllers.
 *
 * TABLA `permisos`
 * ---------------------------------------------------------------------
 *   id_permiso      INT PK AUTO_INCREMENT
 *   nombre_permiso  VARCHAR(80) NOT NULL UNIQUE
 *   descripcion     VARCHAR(255) NULL
 *   estado          ENUM('activo','inactivo') DEFAULT 'activo'
 * No tiene fecha_creacion: es un catalogo, su historial vive en
 * bitacora cuando corresponda.
 */

const db = require('../config/database');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const { Permiso } = require('../models');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES } = require('../utils/constants');
const {
  limpiarTexto,
  soloCamposPermitidos,
  normalizarPaginacion
} = require('../utils/formato');

class PermisoService {
  /**
   * Campos que el cliente tiene permitido escribir.
   *
   * NUNCA se pasa req.body tal cual al SQL. Este listado es la
   * proteccion contra campos de mas (id_permiso, fechas, etc.) que
   * podrian alterar datos que no corresponden.
   */
  #camposPermitidos = ['nombrePermiso', 'descripcion', 'estado'];

  /**
   * Traduce cada campo del body a su columna real, para el UPDATE
   * DINAMICO: solo se escribe lo que llego, con el nombre correcto.
   */
  #mapaColumnas = {
    nombrePermiso: 'nombre_permiso',
    descripcion: 'descripcion',
    estado: 'estado'
  };

  // =================================================================
  // LISTADO
  // ================================================================

  /**
   * Lista permisos con filtros y paginacion.
   *
   * Filtros admitidos:
   *   ?estado=activo          filtra por estado
   *   ?busqueda=roles         busca en nombre_permiso y descripcion
   *   ?pagina=1&limite=20     paginacion
   *
   * @param {object} filtros  Tipicamente req.query.
   * @returns {Promise<{permisos: Permiso[], total: number, pagina: number, limite: number}>}
   */
  async listar(filtros = {}) {
    const { pagina, limite, desplazamiento } = normalizarPaginacion(
      filtros,
      LIMITES.LIMITE_DEFECTO,
      LIMITES.LIMITE_PAGINA
    );

    const condiciones = [];
    const parametros = [];

    // ---- Filtro por estado ----
    // Solo se acepta si esta en la lista cerrada; asi se evita
    // mandar al SQL un valor que MySQL rechazaria igual.
    if (filtros.estado) {
      const estado = limpiarTexto(String(filtros.estado));

      if (Object.values(ESTADO).includes(estado)) {
        condiciones.push('p.estado = ?');
        parametros.push(estado);
      }
    }

    // ---- Busqueda por texto ----
    if (filtros.busqueda && limpiarTexto(String(filtros.busqueda)) !== '') {
      const texto = limpiarTexto(String(filtros.busqueda));

      // LIKE con % a los dos lados busca "en cualquier parte".
      // Se escapa el caracter % para que un usuario que escriba "%"
      // no convierta la busqueda en "traer todo".
      condiciones.push('(p.nombre_permiso LIKE ? OR p.descripcion LIKE ?)');
      const patron = `%${texto.replace(/[%_]/g, '\\$&')}%`;
      parametros.push(patron, patron);
    }

    const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    // ---- Total (para el objeto meta de paginacion) ----
    const filaTotal = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM permisos p ${donde}`,
      parametros
    );
    const total = Number(filaTotal?.total ?? 0);

    // ---- Filas de la pagina ----
    //
    // LIMIT/OFFSET se escriben directamente en la cadena y NO con ?.
    // Motivo: mysql2 en modo execute() exige que los placeholders de
    // LIMIT lleguen como numeros y a veces devuelve NaN; ademas
    // `desplazamiento` y `limite` ya son enteros acotados por
    // normalizarPaginacion, por lo que no hay riesgo de inyeccion.
    const filas = await db.ejecutar(
      `SELECT p.id_permiso, p.nombre_permiso, p.descripcion, p.estado
         FROM permisos p
         ${donde}
        ORDER BY p.nombre_permiso
        LIMIT ${limite} OFFSET ${desplazamiento}`,
      parametros
    );

    return {
      permisos: filas.map((fila) => Permiso.desdeFila(fila)),
      total,
      pagina,
      limite
    };
  }

  // =================================================================
  // DETALLE
  // ================================================================

  /**
   * Busca un permiso por su id.
   *
   * @param {number} id
   * @returns {Promise<Permiso>}
   * @throws {AppError} 404 si no existe.
   */
  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      'SELECT id_permiso, nombre_permiso, descripcion, estado FROM permisos WHERE id_permiso = ?',
      [id]
    );

    if (fila === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.PERMISO_NO_EXISTE(id));
    }

    return Permiso.desdeFila(fila);
  }

  // =================================================================
  // CREACION
  // ================================================================

  /**
   * Valida y guarda un permiso nuevo.
   *
   * @param {object} datos  req.body.
   * @returns {Promise<Permiso>} El permiso construido aqui, ya con su
   *          id: se devuelve la INSTANCIA sin re-leer la fila (mismo
   *          estilo que el ejemplo).
   * @throws {AppError} 400 si los datos son invalidos, 409 si el
   *                    nombre ya existe.
   */
  async crear(datos) {
    const entrada = soloCamposPermitidos(datos, this.#camposPermitidos);

    const normalizados = this.#validar(entrada);

    await this.#asegurarNombreUnico(normalizados.nombrePermiso, null);

    // 1. Instanciar el objeto del dominio.
    const permiso = Permiso.desdeJSON(normalizados);

    // 2. Persistir: aFilaBaseDatos() traduce el objeto a columnas.
    const fila = permiso.aFilaBaseDatos();

    const resultado = await db.ejecutar(
      'INSERT INTO permisos (nombre_permiso, descripcion, estado) VALUES (?, ?, ?)',
      [fila.nombre_permiso, fila.descripcion, fila.estado]
    );

    // insertId lo devuelve mysql2 en los metadatos del INSERT; el id
    // lo asigna el SETTER, igual que en el ejemplo.
    permiso.id = resultado.insertId;

    return permiso;
  }

  // =================================================================
  // ACTUALIZACION
  // ================================================================

  /**
   * Actualizacion PARCIAL (PUT): solo se modifican los campos que
   * llegaron. Postman, por ejemplo, manda un PUT con unicamente
   * `descripcion` y el nombre no debe tocarse.
   *
   * @param {number} id
   * @param {object} datos
   * @returns {Promise<Permiso>} El permiso releido al final, igual que
   *          el ejemplo (`return this.obtenerPorId(id)`).
   * @throws {AppError} 404, 400 o 409.
   */
  async actualizar(id, datos) {
    // 1. Verificar que exista. Si no, obtenerPorId lanza el 404.
    const permiso = await this.obtenerPorId(id);

    const entrada = soloCamposPermitidos(datos, this.#camposPermitidos);

    if (Object.keys(entrada).length === 0) {
      throw AppError.cuerpoInvalido(
        'La peticion no incluye ningun campo actualizable. Se admiten: ' +
          this.#camposPermitidos.join(', ')
      );
    }

    // 2. Normalizar y validar el conjunto COMPLETO: se parte del
    //    registro EXISTENTE y se pisan solo los campos que llegaron,
    //    asi las validaciones siempre ven el conjunto completo.
    const paraValidar = {
      nombrePermiso: entrada.nombrePermiso ?? permiso.nombrePermiso,
      descripcion: entrada.descripcion ?? permiso.descripcion,
      estado: entrada.estado ?? permiso.estado
    };

    const normalizados = this.#validar(paraValidar);

    // Solo se revisa la unicidad si el nombre cambio; comprobarlo
    // aunque fuera igual generaria una consulta inutil en cada PUT.
    if (normalizados.nombrePermiso !== permiso.nombrePermiso) {
      await this.#asegurarNombreUnico(normalizados.nombrePermiso, id);
    }

    // 3. Aplicar los cambios AL OBJETO usando sus SETTERS.
    for (const campo of Object.keys(entrada)) {
      permiso[campo] = normalizados[campo];
    }

    // 4. UPDATE DINAMICO: solo las columnas que efectivamente
    //    cambiaron, con sus valores salidos de aFilaBaseDatos().
    const fila = permiso.aFilaBaseDatos();
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
        `UPDATE permisos SET ${asignaciones.join(', ')} WHERE id_permiso = ?`,
        parametros
      );
    }

    return this.obtenerPorId(id);
  }

  // =================================================================
  // CAMBIO DE ESTADO (PATCH)
  // ================================================================

  /**
   * Cambia solo el estado del permiso. Es la operacion de "baja
   * logica": el registro sigue existiendo, solo deja de estar activo.
   *
   * @param {number} id
   * @param {string} estado  'activo' | 'inactivo'
   * @returns {Promise<Permiso>} La MISMA instancia con el estado ya
   *          cambiado (no se re-lee la fila), como en el ejemplo.
   */
  async cambiarEstado(id, estado) {
    const permiso = await this.obtenerPorId(id); // 404 si no existe

    const errores = new ColectorErrores();
    errores.exigirValorDeLista('estado', estado, Object.values(ESTADO));
    errores.lanzarSiHayErrores();

    // El objeto decide como representar su propio estado.
    if (estado === ESTADO.ACTIVO) {
      permiso.activar();
    } else {
      permiso.desactivar();
    }

    await db.ejecutar('UPDATE permisos SET estado = ? WHERE id_permiso = ?', [
      permiso.estado,
      id
    ]);

    return permiso;
  }

  // =================================================================
  // ELIMINACION
  // ================================================================

  /**
   * Borra un permiso.
   *
   * NOTA DE INTEGRIDAD: `rol_permiso` tiene ON DELETE CASCADE en la
   * llave foranea hacia permisos. Si el permiso estaba asignado a
   * cinco roles, MySQL borra solo esas cinco filas puente. Por eso
   * aqui NUNCA puede fallar por "registro en uso": no hace falta
   * rechazar nada con 409.
   *
   * @param {number} id
   * @returns {Promise<object>} Resumen en el MISMO estilo que el
   *          ejemplo: llave `id` y sin campo `mensaje`.
   * @throws {AppError} 404 si no existe.
   */
  async eliminar(id) {
    const existente = await this.obtenerPorId(id);

    await db.ejecutar('DELETE FROM permisos WHERE id_permiso = ?', [id]);

    return {
      id: existente.id,
      nombrePermiso: existente.nombrePermiso
    };
  }

  // =================================================================
  // METODOS PRIVADOS DE APOYO
  // ================================================================

  /**
   * Valida una tanda de campos y devuelve un objeto PLANO ya limpio.
   *
   * Se hace en un solo paso porque el ColectorErrores junta TODOS los
   * problemas y los lanza de una sola vez, en vez de devolver un
   * error cada vez.
   *
   * Devuelve un objeto normalizado (no una instancia): quien persiste
   * es `crear()`, que construye el Permiso con `Permiso.desdeJSON(...)`.
   * Asi validacion y fabricacion quedan separadas, como en el ejemplo.
   *
   * @param {object} entrada
   * @returns {object}
   * @throws {AppError} 400 con el detalle campo a campo.
   */
  #validar(entrada) {
    const errores = new ColectorErrores();

    errores.exigirTexto('nombrePermiso', entrada.nombrePermiso, {
      maximo: LIMITES.NOMBRE_PERMISO
    });

    errores.exigirTexto('descripcion', entrada.descripcion, {
      maximo: LIMITES.DESCRIPCION,
      requerido: false
    });

    if (entrada.estado !== undefined && entrada.estado !== null && entrada.estado !== '') {
      errores.exigirValorDeLista('estado', entrada.estado, Object.values(ESTADO));
    }

    errores.lanzarSiHayErrores();

    // normalizacion identica a la del modelo (trim), para que el
    // resultado sea el mismo venga de donde venga.
    return {
      nombrePermiso: String(entrada.nombrePermiso).trim(),
      descripcion:
        entrada.descripcion === undefined || entrada.descripcion === null
          ? null
          : String(entrada.descripcion).trim(),
      estado: entrada.estado || ESTADO.ACTIVO
    };
  }

  /**
   * Comprueba que el nombre del permiso no este tomado.
   *
   * @param {string} nombre
   * @param {number|null} idExcluido  El propio id cuando es un PUT.
   * @throws {AppError} 409 si ya existe.
   */
  async #asegurarNombreUnico(nombre, idExcluido) {
    const fila = await db.obtenerUno(
      'SELECT id_permiso FROM permisos WHERE nombre_permiso = ? AND id_permiso <> ?',
      [nombre, idExcluido ?? -1]
    );

    if (fila !== null) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.PERMISO_DUPLICADO(nombre));
    }
  }
}

module.exports = new PermisoService();
