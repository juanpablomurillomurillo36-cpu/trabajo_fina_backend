/**
 * src/services/rol.service.js
 * ---------------------------------------------------------------------
 * CAPA DE SERVICIO de la entidad Rol.
 *
 * REGLAS DE NEGOCIO QUE RESUELVE ESTA CLASE
 *   1. nombre_rol UNICO          -> 409 si ya lo usa otro rol.
 *   2. id inexistente            -> 404.
 *   3. no se borra un rol con    -> 409 ROL_EN_USO.
 *      usuarios asignados           (los usuarios quedarian huérfanos)
 *   4. el detalle TRAE sus       -> via RolPermisoRepository.
 *      permisos cargados
 *
 * POR QUE NO SE PUDE BORRAR UN ROL EN USO?
 * Porque la columna usuarios.id_rol es FOREIGN KEY; si se fuera la
 * referencia, MySQL devolveria un error crudo. Avisar con 409 y un
 * mensaje claro es infinitamente mejor.
 *
 * Nota de diseno (fase 15): este service SOLO LEE los permisos del rol.
 * Asignarlos y quitarlos llega en la fase 16, con endpoints propios.
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { LIMITES, ESTADO } = require('../utils/constants');
const { Rol } = require('../models');
const rolRepository = require('../repositories/RolRepository');
const rolPermisoRepository = require('../repositories/RolPermisoRepository');

// Lista blanca: cualquier otra llave del cuerpo se descarta antes de
// validar (evita que un cliente mande id o fechaCreacion y los "peguen").
const CAMPOS_PERMITIDOS = ['nombreRol', 'descripcion', 'estado'];

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];

class RolService {
  /**
   * LISTAR con filtros opcionales y paginacion.
   *
   * @param {object} filtros  req.query
   * @returns {Promise<{roles: Rol[], total: number, pagina: number, limite: number}>}
   */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = this.#normalizarEstadoConsulta(filtros.estado);
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { roles, total } = await rolRepository.listar({ estado, busqueda, pagina, limite });

    return { roles, total, pagina, limite };
  }

  /**
   * OBTENER un rol con sus permisos cargados.
   *
   * @param {number} id
   * @param {object} [opciones]
   * @param {boolean} [opciones.incluirPermisos]  Por defecto true.
   * @returns {Promise<Rol>}
   * @throws {AppError} 404
   */
  async obtenerPorId(id, { incluirPermisos = true } = {}) {
    const rol = await rolRepository.obtenerPorId(id);

    if (rol === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('rol'));
    }

    // Cargar los permisos es OTRA consulta; se hace solo cuando se
    // necesita. El listado (listar()) no la hace: seria un viaje a la
    // base por cada rol de la pagina.
    if (incluirPermisos) {
      const permisos = await rolPermisoRepository.listarPermisosDeRol(id);

      // agregarPermiso ademas mantiene el contador totalPermisos al
      // dia y evita duplicados si la misma fila llegara dos veces.
      for (const permiso of permisos) {
        rol.agregarPermiso(permiso);
      }
    }

    return rol;
  }

  /**
   * CREAR un rol nuevo.
   *
   * @param {object} datosCrudos  req.body
   * @returns {Promise<Rol>}
   */
  async crear(datosCrudos) {
    const datos = this.#normalizar(datosCrudos);

    this.#validarCreacion(datos);
    await this.#verificarNombreUnico(datos.nombreRol);

    const rol = Rol.desdeJSON(datos);

    rol.id = await rolRepository.crear(rol);

    return rol;
  }

  /**
   * ACTUALIZAR un rol existente.
   *
   * @param {number} id
   * @param {object} datosCrudos
   * @returns {Promise<Rol>}
   */
  async actualizar(id, datosCrudos) {
    const rol = await this.obtenerPorId(id, { incluirPermisos: false });

    const datos = this.#normalizar(datosCrudos);
    this.#validarActualizacion(datos);

    // Si el nombre cambio, no puede chocar con otro rol. Se excluye el
    // propio id para que no se compare asi consigo mismo.
    if (Object.hasOwn(datos, 'nombreRol')) {
      await this.#verificarNombreUnico(datos.nombreRol, id);
    }

    // Se pegan SOLO los campos que llegaron: los demas conservan su
    // valor (actualizacion parcial).
    if (Object.hasOwn(datos, 'nombreRol')) rol.nombreRol = datos.nombreRol;
    if (Object.hasOwn(datos, 'descripcion')) rol.descripcion = datos.descripcion;
    if (Object.hasOwn(datos, 'estado')) rol.estado = datos.estado;

    await rolRepository.actualizar(id, rol);

    return rol;
  }

  /**
   * CAMBIAR el estado sin tocar los demas campos.
   *
   * @param {number} id
   * @param {object} datosCrudos  { estado }
   * @returns {Promise<Rol>}
   */
  async cambiarEstado(id, datosCrudos) {
    const rol = await this.obtenerPorId(id, { incluirPermisos: false });

    const errores = new ColectorErrores();
    errores.exigirValorDeLista('estado', datosCrudos?.estado, ESTADOS_PERMITIDOS);
    errores.lanzarSiHay('No se pudo cambiar el estado del rol.');

    await rolRepository.cambiarEstado(id, datosCrudos.estado);

    rol.estado = datosCrudos.estado;

    return rol;
  }

  /**
   * ELIMINAR un rol.
   *
   * @param {number} id
   * @returns {Promise<{id: number, nombreRol: string, usuariosAsignados: number}>}
   * @throws {AppError} 404 si no existe, 409 si hay usuarios.
   */
  async eliminar(id) {
    const rol = await this.obtenerPorId(id, { incluirPermisos: false });

    const usuariosAsignados = await rolRepository.contarUsuariosAsignados(id);

    if (usuariosAsignados > 0) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.ROL_EN_USO, [
        {
          campo: 'usuarios',
          mensaje: `Hay ${usuariosAsignados} usuario(s) con este rol. Reasignalos o desactiva el rol en su lugar.`
        }
      ]);
    }

    await rolRepository.eliminar(id);

    return {
      id: rol.id,
      nombreRol: rol.nombreRol,
      usuariosAsignados
    };
  }

  // ==================================================================
  // PRIVADAS
  // ==================================================================

  /**
   * Filtra el cuerpo contra la lista blanca.
   *
   * @param {object} datosCrudos
   * @returns {object}
   */
  #normalizar(datosCrudos) {
    const filtrados = formato.soloCamposPermitidos(datosCrudos, CAMPOS_PERMITIDOS);
    const limpios = {};

    if (Object.hasOwn(filtrados, 'nombreRol')) {
      limpios.nombreRol = formato.limpiarTexto(filtrados.nombreRol);
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
   * Valida la CREACION.
   *
   * @param {object} datos
   * @throws {AppError} 400 con TODOS los errores juntos.
   */
  #validarCreacion(datos) {
    const errores = new ColectorErrores();

    // roles.nombre_rol: VARCHAR(50) NOT NULL y ademas UNIQUE.
    errores.exigirTexto('nombreRol', datos.nombreRol, { maximo: LIMITES.VARCHAR_ROL });

    // roles.descripcion: VARCHAR(255) NULL -> opcional.
    errores.exigirTexto('descripcion', datos.descripcion, {
      requerido: false,
      maximo: LIMITES.VARCHAR_DESCRIPCION
    });

    errores.exigirValorDeLista('estado', datos.estado, ESTADOS_PERMITIDOS, {
      requerido: false
    });

    errores.lanzarSiHay('No se pudo crear el rol porque hay datos invalidos.');
  }

  /**
   * Valida la ACTUALIZACION (todos los campos opcionales).
   *
   * @param {object} datos
   * @throws {AppError} 400
   */
  #validarActualizacion(datos) {
    if (formato.estaVacio(datos)) {
      throw AppError.validacion('Debes enviar al menos un campo valido para actualizar.', [
        { campo: 'cuerpo', mensaje: `Campos admitidos: ${CAMPOS_PERMITIDOS.join(', ')}.` }
      ]);
    }

    const errores = new ColectorErrores();

    if (Object.hasOwn(datos, 'nombreRol')) {
      errores.exigirTexto('nombreRol', datos.nombreRol, { maximo: LIMITES.VARCHAR_ROL });
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

    errores.lanzarSiHay('No se pudo actualizar el rol porque hay datos invalidos.');
  }

  /**
   * Comprueba la unicidad del nombre (409 si ya existe).
   *
   * @param {string}      nombre
   * @param {number|null} [idExcluido]
   * @throws {AppError} 409
   */
  async #verificarNombreUnico(nombre, idExcluido = null) {
    const yaExiste = await rolRepository.existeNombre(nombre, idExcluido);

    if (yaExiste) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('rol', nombre), [
        { campo: 'nombreRol', mensaje: 'Ese nombre ya esta en uso por otro rol.' }
      ]);
    }
  }

  /**
   * Valida el filtro ?estado= de la consulta.
   *
   * @param {*} valor
   * @returns {string|null}
   * @throws {AppError} 400
   */
  #normalizarEstadoConsulta(valor) {
    const texto = formato.limpiarTexto(valor);

    if (texto === null) return null;

    if (!ESTADOS_PERMITIDOS.includes(texto)) {
      throw AppError.validacion('El filtro de estado no es valido.', [
        { campo: 'estado', mensaje: `Valores admitidos: ${ESTADOS_PERMITIDOS.join(', ')}.` }
      ]);
    }

    return texto;
  }
}

// SINGLETON
module.exports = new RolService();
