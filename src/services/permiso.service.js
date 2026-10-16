/**
 * src/services/permiso.service.js
 * ---------------------------------------------------------------------
 * CAPA DE SERVICIO de la entidad Permiso.
 *
 * QUE SABE ESTA CLASE?
 *   - QUE campos admite y como normalizarlos (lista blanca).
 *   - LAS REGLAS de negocio: nombre unico (409), no se puede borrar un
 *     permiso que este asignado a un rol (409), id inexistente (404).
 *   - QUE respuesta de error corresponde (AppError con su codigo HTTP).
 *
 * QUE NO SABE?
 *   - Nada de SQL: eso vive en PermisoRepository.
 *   - Nada de HTTP/Express: no toca req ni res. Recibe datos crudos y
 *     devuelve objetos. Gracias a eso el mismo service podria usarse
 *     desde un script, una prueba o una cola de mensajes.
 *
 * FLUJO DE CREAR/ACTUALIZAR (patron del ejemplo del profesor):
 *   normalizar -> validar -> reglas de negocio -> persistir
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { LIMITES, ESTADO } = require('../utils/constants');
const { Permiso } = require('../models');
const permisoRepository = require('../repositories/PermisoRepository');

// Lista blanca de campos que el cliente puede enviar.
// Cualquier otra llave del cuerpo (id, fechaCreacion, usuarioAdmin...)
// se descarta antes de validar: evita que un cliente "sobrescriba"
// campos internos enviandolos en el JSON.
const CAMPOS_PERMITIDOS = ['nombrePermiso', 'descripcion', 'estado'];

// Los dos estados posibles de la columna ENUM `permisos.estado`.
const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];

class PermisoService {
  /**
   * LISTAR con filtros opcionales y paginacion.
   *
   * @param {object} filtros  req.query tal como llego.
   * @returns {Promise<{permisos: Permiso[], total: number, pagina: number, limite: number}>}
   */
  async listar(filtros = {}) {
    // ---- Paginacion ----
    // Si el cliente no envia nada, usamos los valores por defecto.
    const paginaSolicitada = formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO;
    const limiteSolicitado = formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO;

    // Math.max(1, ...) evita paginas 0 o negativas.
    const pagina = Math.max(1, paginaSolicitada);

    // Math.min protege el servidor: aunque pidan limite=100000, el
    // tope real es LIMITE_MAXIMO.
    const limite = Math.min(Math.max(1, limiteSolicitado), LIMITES.LIMITE_MAXIMO);

    // ---- Estado ----
    // Si viene, debe ser un valor valido del ENUM; no tiene sentido
    // filtrar por algo que jamas existira en la base.
    const estado = this.#normalizarEstadoConsulta(filtros.estado);

    // ---- Busqueda ----
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { permisos, total } = await permisoRepository.listar({
      estado,
      busqueda,
      pagina,
      limite
    });

    return { permisos, total, pagina, limite };
  }

  /**
   * OBTENER un permiso por id.
   *
   * @param {number} id
   * @returns {Promise<Permiso>}
   * @throws {AppError} 404 si no existe.
   */
  async obtenerPorId(id) {
    const permiso = await permisoRepository.obtenerPorId(id);

    // Regla de negocio: si no existe, es un 404 y no una lista vacia.
    if (permiso === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('permiso'));
    }

    return permiso;
  }

  /**
   * CREAR un permiso nuevo.
   *
   * @param {object} datosCrudos  req.body
   * @returns {Promise<Permiso>}  El permiso creado, ya con su id.
   */
  async crear(datosCrudos) {
    // 1. Normalizar: solo campos de la lista blanca, ya recortados.
    const datos = this.#normalizar(datosCrudos);

    // 2. Validar: recoge TODOS los errores de una sola vez.
    this.#validarCreacion(datos);

    // 3. Regla de negocio: el nombre debe ser unico.
    await this.#verificarNombreUnico(datos.nombrePermiso);

    // 4. Instanciar el objeto del dominio.
    const permiso = Permiso.desdeJSON(datos);

    // 5. Persistir: el repository devuelve el id autogenerado y lo
    //    asignamos POR EL SETTER (no tocamos el atributo privado).
    permiso.id = await permisoRepository.crear(permiso);

    return permiso;
  }

  /**
   * ACTUALIZAR un permiso existente (actualizacion completa o parcial).
   *
   * @param {number} id
   * @param {object} datosCrudos  req.body
   * @returns {Promise<Permiso>}  El permiso ya actualizado.
   */
  async actualizar(id, datosCrudos) {
    // 1. Verificar que exista. Si no, obtenerPorId lanza el 404.
    const permisoActual = await this.obtenerPorId(id);

    // 2. Normalizar y validar solo lo que llego.
    const datos = this.#normalizar(datosCrudos);
    this.#validarActualizacion(datos);

    // 3. Regla de negocio: si cambio el nombre, no puede chocar con otro.
    //    Se EXCLUYE el propio id, o sino siempre chocaria consigo mismo.
    if (Object.hasOwn(datos, 'nombrePermiso')) {
      await this.#verificarNombreUnico(datos.nombrePermiso, id);
    }

    // 4. Aplicar los cambios al objeto EXISTENTE en vez de crear uno
    //    nuevo: asi los campos que no llegaron conservan su valor.
    if (Object.hasOwn(datos, 'nombrePermiso')) {
      permisoActual.nombrePermiso = datos.nombrePermiso;
    }
    if (Object.hasOwn(datos, 'descripcion')) {
      permisoActual.descripcion = datos.descripcion;
    }
    if (Object.hasOwn(datos, 'estado')) {
      permisoActual.estado = datos.estado;
    }

    // 5. Persistir. Si affectedRows fuera 0 significaria que los valores
    //    eran identicos a los ya guardados: no es un error, seguimos.
    await permisoRepository.actualizar(id, permisoActual);

    return permisoActual;
  }

  /**
   * CAMBIAR el estado (activo / inactivo) sin tocar los demas campos.
   *
   * @param {number} id
   * @param {object} datosCrudos  { estado: 'activo' | 'inactivo' }
   * @returns {Promise<Permiso>}
   */
  async cambiarEstado(id, datosCrudos) {
    const permiso = await this.obtenerPorId(id);

    const errores = new ColectorErrores();
    errores.exigirValorDeLista('estado', datosCrudos?.estado, ESTADOS_PERMITIDOS);
    errores.lanzarSiHay('No se pudo cambiar el estado del permiso.');

    await permisoRepository.cambiarEstado(id, datosCrudos.estado);

    // Devolvemos el objeto con el nuevo estado. No se vuelve a consultar
    // la base: sabemos con certeza que acaba de cambiar.
    permiso.estado = datosCrudos.estado;

    return permiso;
  }

  /**
   * ELIMINAR un permiso.
   *
   * @param {number} id
   * @returns {Promise<{id: number, nombrePermiso: string, rolesAfectados: number}>}
   * @throws {AppError} 404 si no existe, 409 si esta asignado a roles.
   */
  async eliminar(id) {
    const permiso = await this.obtenerPorId(id);

    // Regla de negocio: no se puede borrar un permiso que los roles ya
    // usan, porque MySQL lo quitaria en cascada de TODOS esos roles
    // (ON DELETE CASCADE) sin avisar. Mejor frenar y avisar.
    const rolesAfectados = await permisoRepository.contarRolesAsignados(id);

    if (rolesAfectados > 0) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.PERMISO_EN_USO, [
        {
          campo: 'roles',
          mensaje: `El permiso esta asignado a ${rolesAfectados} rol(es). Quitalo de ellos o desactivalo antes de eliminarlo.`
        }
      ]);
    }

    await permisoRepository.eliminar(id);

    return {
      id: permiso.id,
      nombrePermiso: permiso.nombrePermiso,
      rolesAfectados
    };
  }

  // ==================================================================
  // METODOS PRIVADOS  (solo se usan dentro de esta clase)
  // ==================================================================

  /**
   * Filtra el cuerpo contra la lista blanca: conserva unicamente los
   * campos que esta API sabe manejar y descarta todo lo demas.
   *
   * @param {object} datosCrudos  req.body
   * @returns {object} Solo los campos permitidos, ya recortados.
   */
  #normalizar(datosCrudos) {
    const filtrados = formato.soloCamposPermitidos(datosCrudos, CAMPOS_PERMITIDOS);
    const limpios = {};

    // Object.hasOwn comprueba si la llave REALMENTE llego. Esto es
    // clave para el PUT parcial: si el cliente no envio `descripcion`,
    // no la convertimos en null y no borramos el dato existente.
    if (Object.hasOwn(filtrados, 'nombrePermiso')) {
      limpios.nombrePermiso = formato.limpiarTexto(filtrados.nombrePermiso);
    }

    if (Object.hasOwn(filtrados, 'descripcion')) {
      limpios.descripcion = formato.limpiarTexto(filtrados.descripcion);
    }

    if (Object.hasOwn(filtrados, 'estado')) {
      limpios.estado = filtrados.estado;
    }

    return limpios;
  }

  /**
   * Valida la CREACION: aqui todos los campos obligatorios que la
   * base marca como NOT NULL.
   *
   * @param {object} datos  Ya normalizados.
   * @throws {AppError} 400 con la lista COMPLETA de errores.
   */
  #validarCreacion(datos) {
    const errores = new ColectorErrores();

    // Columna permisos.nombre_permiso: VARCHAR(80) NOT NULL.
    errores.exigirTexto('nombrePermiso', datos.nombrePermiso, {
      maximo: LIMITES.VARCHAR_MEDIO
    });

    // Columna permisos.descripcion: VARCHAR(255) NULL -> opcional.
    errores.exigirTexto('descripcion', datos.descripcion, {
      requerido: false,
      maximo: LIMITES.VARCHAR_DESCRIPCION
    });

    // Columna permisos.estado: ENUM con valor por defecto 'activo'.
    errores.exigirValorDeLista('estado', datos.estado, ESTADOS_PERMITIDOS, {
      requerido: false
    });

    errores.lanzarSiHay('No se pudo crear el permiso porque hay datos invalidos.');
  }

  /**
   * Valida la ACTUALIZACION. Todos los campos son opcionales (PUT
   * parcial), pero si vienen, tienen que ser validos.
   *
   * @param {object} datos  Ya normalizados.
   * @throws {AppError} 400
   */
  #validarActualizacion(datos) {
    // Enviar un cuerpo sin ningun campo util no tiene sentido.
    if (formato.estaVacio(datos)) {
      throw AppError.validacion('Debes enviar al menos un campo valido para actualizar.', [
        { campo: 'cuerpo', mensaje: `Campos admitidos: ${CAMPOS_PERMITIDOS.join(', ')}.` }
      ]);
    }

    const errores = new ColectorErrores();

    // El patron es: "si el cliente envio este campo, validalo".
    if (Object.hasOwn(datos, 'nombrePermiso')) {
      errores.exigirTexto('nombrePermiso', datos.nombrePermiso, {
        maximo: LIMITES.VARCHAR_MEDIO
      });
    }

    if (Object.hasOwn(datos, 'descripcion')) {
      errores.exigirTexto('descripcion', datos.descripcion, {
        requerido: false,
        maximo: LIMITES.VARCHAR_DESCRIPCION
      });
    }

    if (Object.hasOwn(datos, 'estado')) {
      errores.exigirValorDeLista('estado', datos.estado, ESTADOS_PERMITIDOS);
    }

    errores.lanzarSiHay('No se pudo actualizar el permiso porque hay datos invalidos.');
  }

  /**
   * Comprueba la unicidad del nombre y lanza 409 si ya existe.
   *
   * Se consulta en la base (no en memoria) porque puede haber 1000
   * permisos y cargarlos todos solo para comparar uno seria absurdo.
   * La propiedad UNIQUE de la columna es el respaldo final.
   *
   * @param {string}      nombre
   * @param {number|null} [idExcluido]  Se ignora en la edicion.
   * @throws {AppError} 409
   */
  async #verificarNombreUnico(nombre, idExcluido = null) {
    const yaExiste = await permisoRepository.existeNombre(nombre, idExcluido);

    if (yaExiste) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('permiso', nombre), [
        { campo: 'nombrePermiso', mensaje: 'Ese nombre ya esta en uso por otro permiso.' }
      ]);
    }
  }

  /**
   * Normaliza y valida el estado que llega en la QUERY de listado.
   *
   * @param {*} valor  Lo que llego en ?estado=
   * @returns {string|null} El estado valido, o null para no filtrar.
   * @throws {AppError} 400 si el valor no pertenece al ENUM.
   */
  #normalizarEstadoConsulta(valor) {
    const texto = formato.limpiarTexto(valor);

    // Sin filtro: se listan todos (activos e inactivos).
    if (texto === null) {
      return null;
    }

    if (!ESTADOS_PERMITIDOS.includes(texto)) {
      throw AppError.validacion('El filtro de estado no es valido.', [
        {
          campo: 'estado',
          mensaje: `Valores admitidos: ${ESTADOS_PERMITIDOS.join(', ')}.`
        }
      ]);
    }

    return texto;
  }
}

// ---------------------------------------------------------------------
// SINGLETON: se exporta una instancia, no la clase.
// ---------------------------------------------------------------------
module.exports = new PermisoService();
