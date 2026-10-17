/**
 * src/services/categoria-empleado.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `categoria_empleado`:
 *  - `nombre` DEBE ser uno de los cargos del ENUM (CARGO_EMPLEADO) ->
 *    400 si no pertenece al dominio.
 *  - El ENUM tiene indice unico: nombre repetido -> 409 (contra TODOS
 *    los registros, aunque esten inactivos).
 *  - eliminar -> 409 si hay empleados en la categoria.
 *  Sin try/catch (R-ASYNC).
 */

const categoriaEmpleadoRepository = require('../repositories/CategoriaEmpleadoRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES, CARGO_EMPLEADO } = require('../utils/constants');

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];
const CARGOS = Object.values(CARGO_EMPLEADO);

/**
 * Precedencia: 400 (dominio/campos) -> 409 (duplicado).
 *
 * @param {object} cuerpo
 * @param {number|null} [idActual]
 * @param {string} [estadoActual]
 * @returns {Promise<object>} datos snake_case.
 */
async function preparar(cuerpo, idActual = null, estadoActual = ESTADO.ACTIVO) {
  const colector = new ColectorErrores();
  const datos = {};

  colector.exigirValorDeLista('nombre', cuerpo?.nombre, CARGOS);
  datos.nombre = formato.limpiarTexto(cuerpo?.nombre) || '';

  const nombreDuplicado = datos.nombre !== ''
    ? await categoriaEmpleadoRepository.existeNombre(datos.nombre, idActual)
    : false;

  colector.exigirTexto('descripcion', cuerpo?.descripcion, {
    requerido: false,
    maximo: LIMITES.VARCHAR_DESCRIPCION
  });
  datos.descripcion = formato.limpiarTexto(cuerpo?.descripcion) || null;

  if (cuerpo?.estado !== undefined) {
    colector.exigirValorDeLista('estado', cuerpo.estado, ESTADOS_PERMITIDOS);
    datos.estado = cuerpo.estado;
  } else {
    datos.estado = estadoActual;
  }

  colector.lanzarSiHay();

  if (nombreDuplicado) {
    throw AppError.conflicto(
      MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('categoria de empleado', datos.nombre),
      [{ campo: 'nombre', mensaje: MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('categoria de empleado', datos.nombre) }]
    );
  }

  return datos;
}

class CategoriaEmpleadoService {
  /** ?estado=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await categoriaEmpleadoRepository.listar({
      estado, busqueda, pagina, limite
    });
    return { categorias: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const categoria = await categoriaEmpleadoRepository.obtenerPorId(id);
    if (categoria === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('categoria de empleado'));
    }
    return categoria.toJSON();
  }

  async crear(cuerpo) {
    const datos = await preparar(cuerpo);
    const id = await categoriaEmpleadoRepository.crear(datos);
    return this.obtenerPorId(id);
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = await preparar(cuerpo, id, actual.estado);
    await categoriaEmpleadoRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await categoriaEmpleadoRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  async eliminar(id) {
    const categoria = await this.obtenerPorId(id);

    const total = await categoriaEmpleadoRepository.contarEmpleados(id);
    if (total > 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.EN_USO('categoria de empleado', `${total} empleado(s)`)
      );
    }

    await categoriaEmpleadoRepository.eliminar(id);
    return categoria;
  }
}

// Singleton.
module.exports = new CategoriaEmpleadoService();
