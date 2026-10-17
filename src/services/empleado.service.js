/**
 * src/services/empleado.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `empleados`:
 *  - categoria obligatoria, debe EXISTIR y estar ACTIVA -> 400.
 *  - documento obligatorio y UNICO (indice de MySQL) -> 409.
 *  - nombre y apellido obligatorios (max 80).
 *  - eliminar -> 409 si el empleado tiene agenda_empleados.
 *  Precedencia de errores: 400 (campos/FK) -> 409 (documento dup).
 *  Sin try/catch (R-ASYNC).
 */

const empleadoRepository = require('../repositories/EmpleadoRepository');
const categoriaEmpleadoRepository = require('../repositories/CategoriaEmpleadoRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];
const MAXIMO_TELEFONO = 20;

/**
 * @param {object} cuerpo
 * @param {number|null} [idActual]
 * @param {string} [estadoActual]
 * @returns {Promise<object>} datos snake_case.
 */
async function preparar(cuerpo, idActual = null, estadoActual = ESTADO.ACTIVO) {
  const colector = new ColectorErrores();
  const datos = {};

  // --- categoria ------------------------------------------------------
  colector.exigirId('idCategoriaEmpleado', cuerpo?.idCategoriaEmpleado);
  let categoriaOk = false;
  let idCategoria = formato.aEnteroONulo(cuerpo?.idCategoriaEmpleado);
  if (idCategoria !== null) {
    const categoria = await categoriaEmpleadoRepository.obtenerPorId(idCategoria);
    if (categoria === null) {
      colector.agregar('idCategoriaEmpleado', 'La categoria indicada no existe');
    } else if (!categoria.estaActivo()) {
      colector.agregar('idCategoriaEmpleado', 'La categoria indicada esta inactiva');
    } else {
      categoriaOk = true;
    }
  }
  datos.id_categoria_empleado = categoriaOk ? idCategoria : null;

  // --- nombres --------------------------------------------------------
  colector.exigirTexto('nombre', cuerpo?.nombre, { maximo: LIMITES.VARCHAR_MEDIO });
  datos.nombre = formato.limpiarTexto(cuerpo?.nombre) || '';

  colector.exigirTexto('apellido', cuerpo?.apellido, { maximo: LIMITES.VARCHAR_MEDIO });
  datos.apellido = formato.limpiarTexto(cuerpo?.apellido) || '';

  // --- documento (unico) ----------------------------------------------
  colector.exigirTexto('documento', cuerpo?.documento, { maximo: LIMITES.VARCHAR_CORTO });
  datos.documento = formato.limpiarTexto(cuerpo?.documento) || '';

  const documentoDuplicado = datos.documento !== ''
    ? await empleadoRepository.existeDocumento(datos.documento, idActual)
    : false;

  // --- contacto --------------------------------------------------------
  datos.telefono = formato.limpiarTexto(cuerpo?.telefono) || null;
  if (datos.telefono && datos.telefono.length > MAXIMO_TELEFONO) {
    colector.agregar('telefono', `No puede superar ${MAXIMO_TELEFONO} caracteres`);
  }

  const email = formato.limpiarTexto(cuerpo?.email) || '';
  if (email !== '') colector.exigirCorreo('email', email);
  datos.email = email === '' ? null : email.toLowerCase();

  // --- estado ----------------------------------------------------------
  if (cuerpo?.estado !== undefined) {
    colector.exigirValorDeLista('estado', cuerpo.estado, ESTADOS_PERMITIDOS);
    datos.estado = cuerpo.estado;
  } else {
    datos.estado = estadoActual;
  }

  colector.lanzarSiHay();

  if (documentoDuplicado) {
    throw AppError.conflicto(MENSAJES.NEGOCIO.DOCUMENTO_DUPLICADO(datos.documento), [
      { campo: 'documento', mensaje: MENSAJES.NEGOCIO.DOCUMENTO_DUPLICADO(datos.documento) }
    ]);
  }

  return datos;
}

class EmpleadoService {
  /** ?estado=&busqueda=&idCategoria=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);
    const idCategoria = formato.aEnteroONulo(filtros.idCategoria);

    const { total, filas } = await empleadoRepository.listar({
      estado, busqueda, idCategoria, pagina, limite
    });
    return { empleados: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const empleado = await empleadoRepository.obtenerPorId(id);
    if (empleado === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('empleado'));
    }
    return empleado.toJSON();
  }

  async crear(cuerpo) {
    const datos = await preparar(cuerpo);
    const id = await empleadoRepository.crear(datos);
    return this.obtenerPorId(id);
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = await preparar(cuerpo, id, actual.estado);
    await empleadoRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await empleadoRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  async eliminar(id) {
    const empleado = await this.obtenerPorId(id);

    const totalAgenda = await empleadoRepository.contarAgenda(id);
    if (totalAgenda > 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.EN_USO('empleado', `${totalAgenda} turno(s) de agenda`)
      );
    }

    await empleadoRepository.eliminar(id);
    return empleado;
  }
}

// Singleton.
module.exports = new EmpleadoService();
