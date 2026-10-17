/**
 * src/services/categoria-cliente.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `categoria_clientes`:
 *  - nombre obligatorio (max 60), unico entre activos -> 409 (C-02:
 *    sin indice en MySQL, la regla vive aqui).
 *  - eliminar -> 409 si hay clientes en la categoria.
 *  Sin try/catch (R-ASYNC).
 */

const categoriaClienteRepository = require('../repositories/CategoriaClienteRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];
const MAXIMO_NOMBRE = 60;

/**
 * Precedencia: 400 -> 409.
 *
 * @param {object} cuerpo
 * @param {number|null} [idActual]
 * @param {string} [estadoActual]
 * @returns {Promise<object>} datos snake_case.
 */
async function preparar(cuerpo, idActual = null, estadoActual = ESTADO.ACTIVO) {
  const colector = new ColectorErrores();
  const datos = {};

  colector.exigirTexto('nombre', cuerpo?.nombre, { maximo: MAXIMO_NOMBRE });
  datos.nombre = formato.limpiarTexto(cuerpo?.nombre) || '';

  const nombreDuplicado = datos.nombre !== ''
    ? await categoriaClienteRepository.existeNombre(datos.nombre, idActual)
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
      MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('categoria de cliente', datos.nombre),
      [{ campo: 'nombre', mensaje: MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('categoria de cliente', datos.nombre) }]
    );
  }

  return datos;
}

class CategoriaClienteService {
  /** ?estado=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await categoriaClienteRepository.listar({
      estado, busqueda, pagina, limite
    });
    return { categorias: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const categoria = await categoriaClienteRepository.obtenerPorId(id);
    if (categoria === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('categoria de cliente'));
    }
    return categoria.toJSON();
  }

  async crear(cuerpo) {
    const datos = await preparar(cuerpo);
    const id = await categoriaClienteRepository.crear(datos);
    return this.obtenerPorId(id);
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = await preparar(cuerpo, id, actual.estado);
    await categoriaClienteRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await categoriaClienteRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  async eliminar(id) {
    const categoria = await this.obtenerPorId(id);

    const total = await categoriaClienteRepository.contarClientes(id);
    if (total > 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.EN_USO('categoria de cliente', `${total} cliente(s)`)
      );
    }

    await categoriaClienteRepository.eliminar(id);
    return categoria;
  }
}

// Singleton.
module.exports = new CategoriaClienteService();
