/**
 * src/services/producto.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `productos` (C-02 del CAMBIOS.md: la unicidad de
 * nombre NO es indice de MySQL, se controla aqui con SELECT 1 AS existe
 * -> 409 solo entre registros ACTIVOS).
 *
 * Reglas:
 *  - nombre obligatorio (max 120) y unico entre activos (409).
 *  - precio_venta obligatorio >= 0.
 *  - stocks >= 0; si stock_maximo > 0 no puede ser menor que el minimo
 *    ni menor que el actual.
 *  - eliminar: bloqueado (409) si el producto esta en detalle_compras
 *    o detalle_ventas.
 *  - Sin try/catch: los AppError los traduce el errorHandler (R-ASYNC).
 */

const productoRepository = require('../repositories/ProductoRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];

// Entero gigante para reutilizar el rango de exigirEntero como ">=".
const SIN_TOPE = 2147483647;

/**
 * Valida y normaliza el cuerpo de un producto (crear/editar).
 * Precedencia: 400 (campos) primero, 409 (nombre duplicado) despues.
 *
 * @param {object} cuerpo
 * @param {number|null} [idActual]
 * @param {string} [estadoActual]
 * @returns {Promise<object>} datos snake_case para el repository.
 */
async function preparar(cuerpo, idActual = null, estadoActual = ESTADO.ACTIVO) {
  const colector = new ColectorErrores();
  const datos = {};

  // --- nombre --------------------------------------------------------
  colector.exigirTexto('nombre', cuerpo?.nombre, { maximo: LIMITES.VARCHAR_LARGO });
  datos.nombre = formato.limpiarTexto(cuerpo?.nombre) || '';

  const nombreDuplicado = datos.nombre !== ''
    ? await productoRepository.existeNombre(datos.nombre, idActual)
    : false;

  // --- descripcion ---------------------------------------------------
  colector.exigirTexto('descripcion', cuerpo?.descripcion, {
    requerido: false,
    maximo: LIMITES.VARCHAR_DESCRIPCION
  });
  datos.descripcion = formato.limpiarTexto(cuerpo?.descripcion) || null;

  // --- precio --------------------------------------------------------
  colector.exigirDecimal('precioVenta', cuerpo?.precioVenta, { requerido: true, minimo: 0 });
  datos.precio_venta = formato.aDecimalONulo(cuerpo?.precioVenta) ?? 0;

  // --- existencias ---------------------------------------------------
  colector.exigirEntero('stockActual', cuerpo?.stockActual, {
    requerido: false, minimo: 0, maximo: SIN_TOPE
  });
  colector.exigirEntero('stockMinimo', cuerpo?.stockMinimo, {
    requerido: false, minimo: 0, maximo: SIN_TOPE
  });
  colector.exigirEntero('stockMaximo', cuerpo?.stockMaximo, {
    requerido: false, minimo: 0, maximo: SIN_TOPE
  });

  datos.stock_actual = formato.aEnteroONulo(cuerpo?.stockActual) ?? 0;
  datos.stock_minimo = formato.aEnteroONulo(cuerpo?.stockMinimo) ?? 0;
  datos.stock_maximo = formato.aEnteroONulo(cuerpo?.stockMaximo) ?? 0;

  // Coherencia de inventario: solo aplica si hay tope definido (> 0).
  if (datos.stock_maximo > 0 && datos.stock_minimo > datos.stock_maximo) {
    colector.agregar('stockMinimo', 'No puede superar el stock maximo');
  }
  if (datos.stock_maximo > 0 && datos.stock_actual > datos.stock_maximo) {
    colector.agregar('stockActual', 'No puede superar el stock maximo');
  }

  // --- estado --------------------------------------------------------
  if (cuerpo?.estado !== undefined) {
    colector.exigirValorDeLista('estado', cuerpo.estado, ESTADOS_PERMITIDOS);
    datos.estado = cuerpo.estado;
  } else {
    datos.estado = estadoActual;
  }

  colector.lanzarSiHay();

  if (nombreDuplicado) {
    throw AppError.conflicto(MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('producto', datos.nombre), [
      { campo: 'nombre', mensaje: MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('producto', datos.nombre) }
    ]);
  }

  return datos;
}

class ProductoService {
  /** Listar con filtros y paginacion: ?estado=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);
    const soloBajoStock = filtros.bajoStock === 'true' || filtros.bajoStock === '1';

    let total;
    let filas;

    if (soloBajoStock) {
      // RN-03: vista concentrada de productos en alerta de stock.
      const bajos = await productoRepository.listarBajoStock();
      total = bajos.length;
      filas = bajos.slice((pagina - 1) * limite, pagina * limite);
    } else {
      ({ total, filas } = await productoRepository.listar({ estado, busqueda, pagina, limite }));
    }

    return { productos: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const producto = await productoRepository.obtenerPorId(id);
    if (producto === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('producto'));
    }
    return producto.toJSON();
  }

  async crear(cuerpo) {
    const datos = await preparar(cuerpo);
    const id = await productoRepository.crear(datos);
    return this.obtenerPorId(id);
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = await preparar(cuerpo, id, actual.estado);
    await productoRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await productoRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  /** 409 si el producto tiene compras o ventas asociadas. */
  async eliminar(id) {
    const producto = await this.obtenerPorId(id);

    const { compras, ventas } = await productoRepository.contarUsos(id);
    if (compras > 0 || ventas > 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.EN_USO('producto', `${compras} compra(s) y ${ventas} venta(s)`)
      );
    }

    await productoRepository.eliminar(id);
    return producto;
  }
}

// Singleton.
module.exports = new ProductoService();
