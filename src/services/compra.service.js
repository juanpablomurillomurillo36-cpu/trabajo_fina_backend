/**
 * src/services/compra.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `compras` (RN-01) — COMPOSICION P4:
 * la compra y sus lineas se crean/editan/borran JUNTAS o no se hace
 * nada (transaccion). Aqui solo se VALIDA y se DECIDE; el SQL y la
 * transaccion viven en CompraRepository.
 *
 * Reglas de la fase 29 (CRUD):
 *  - proveedor obligatorio, debe EXISTIR y estar ACTIVO -> 400.
 *  - detalles: al menos 1 linea; cada una con producto ACTIVO,
 *    cantidad >= 1 y precio >= 0 -> 400 con detalle por linea.
 *  - total = suma de subtotales (nunca se confia al cliente).
 *  - solo compras PENDIENTES se editan o eliminan -> 409.
 *  Fase 30 agregara confirmar/cancelar con stock.
 *  Sin try/catch (R-ASYNC).
 */

const compraRepository = require('../repositories/CompraRepository');
const proveedorRepository = require('../repositories/ProveedorRepository');
const productoRepository = require('../repositories/ProductoRepository');
const DetalleCompra = require('../models/DetalleCompra');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO_COMPRA, LIMITES } = require('../utils/constants');

/**
 * Valida la cabecera y TODAS las lineas de la compra.
 *
 * Los productos se resuelven en PARALELO (Promise.all) con ids
 * unicos: un body con 10 lineas no dispara 10 selects repetidos.
 *
 * @param {object} cuerpo
 * @param {string} [estadoInicial] 'pendiente' al crear.
 * @returns {Promise<{datos:object, detalles:DetalleCompra[]}>}
 */
async function preparar(cuerpo, estadoInicial = ESTADO_COMPRA.PENDIENTE) {
  const colector = new ColectorErrores();

  // --- proveedor ------------------------------------------------------
  colector.exigirId('idProveedor', cuerpo?.idProveedor);
  const idProveedor = formato.aEnteroONulo(cuerpo?.idProveedor);
  let proveedorOk = false;

  if (idProveedor !== null) {
    const proveedor = await proveedorRepository.obtenerPorId(idProveedor);
    if (proveedor === null) {
      colector.agregar('idProveedor', 'El proveedor indicado no existe');
    } else if (!proveedor.estaActivo()) {
      colector.agregar('idProveedor', 'El proveedor indicado esta inactivo');
    } else {
      proveedorOk = true;
    }
  }

  // --- lineas ----------------------------------------------------------
  const crudos = Array.isArray(cuerpo?.detalles) ? cuerpo.detalles : [];

  if (crudos.length === 0) {
    colector.agregar('detalles', MENSAJES.NEGOCIO.COMPRA_SIN_DETALLES);
  }

  // Productos distintos -> una sola tanda de consultas en paralelo.
  const idsProductos = [
    ...new Set(
      crudos
        .map((d) => formato.aEnteroONulo(d?.idProducto))
        .filter((id) => id !== null)
    )
  ];
  const consultas = await Promise.all(
    idsProductos.map((id) => productoRepository.obtenerPorId(id))
  );
  const mapaProductos = new Map(idsProductos.map((id, i) => [id, consultas[i]]));

  const detalles = [];

  crudos.forEach((linea, i) => {
    const campo = `detalles[${i}]`;
    const idProducto = formato.aEnteroONulo(linea?.idProducto);
    const producto = idProducto !== null ? mapaProductos.get(idProducto) : null;

    if (idProducto === null) {
      colector.agregar(`${campo}.idProducto`, 'Debe ser un id de producto valido');
    } else if (producto === null || !producto.estaActivo()) {
      colector.agregar(
        `${campo}.idProducto`,
        MENSAJES.NEGOCIO.PRODUCTO_NO_EXISTE_EN_CATALOGO(producto?.nombre ?? idProducto)
      );
    }

    const cantidad = formato.aEnteroONulo(linea?.cantidad);
    if (cantidad === null || cantidad < 1) {
      colector.agregar(`${campo}.cantidad`, 'Debe ser un entero mayor o igual a 1');
    }

    const precio = formato.aDecimalONulo(linea?.precioUnitario);
    if (precio === null || precio < 0) {
      colector.agregar(`${campo}.precioUnitario`, 'Debe ser un numero mayor o igual a 0');
    }

    if (producto !== null && producto.estaActivo() && cantidad >= 1 && precio >= 0) {
      detalles.push(new DetalleCompra(null, null, idProducto, cantidad, precio));
    }
  });

  colector.lanzarSiHay();

  if (!proveedorOk) {
    // No deberia llegar: exigirId/agregar ya lanzo. Defensa explicita.
    throw AppError.validacion('El proveedor indicado no es valido');
  }

  // El total NUNCA viene del body: se calcula aqui (fuente unica).
  const total = detalles.reduce((suma, d) => suma + d.subtotal, 0);

  return {
    datos: { id_proveedor: idProveedor, total, estado: estadoInicial },
    detalles
  };
}

class CompraService {
  /** ?estado=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = Object.values(ESTADO_COMPRA).includes(filtros.estado)
      ? filtros.estado
      : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await compraRepository.listar({ estado, busqueda, pagina, limite });
    return { compras: filas, total, pagina, limite };
  }

  /** Cabecera sin lineas. */
  async obtenerPorId(id) {
    const compra = await compraRepository.obtenerPorId(id);
    if (compra === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('compra'));
    }
    return compra.toJSON();
  }

  /** Cabecera CON sus lineas (la lectura natural de una composicion). */
  async obtenerConDetalles(id) {
    const compra = await compraRepository.obtenerConDetalles(id);
    if (compra === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('compra'));
    }
    return compra.toJSON();
  }

  /** Alta en transaccion: compra + lineas o nada. */
  async crear(cuerpo) {
    const { datos, detalles } = await preparar(cuerpo);

    const id = await compraRepository.crearConDetalles(datos, detalles);
    return this.obtenerConDetalles(id);
  }

  /** Edicion en transaccion (solo pendiente). */
  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);

    if (!actual.pendiente) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.COMPRA_NO_EDITABLE);
    }

    const { datos, detalles } = await preparar(cuerpo, actual.estado);
    await compraRepository.actualizarConDetalles(id, datos, detalles);
    return this.obtenerConDetalles(id);
  }

  /** Baja fisica (solo pendiente; detalles caen en cascada). */
  async eliminar(id) {
    const compra = await this.obtenerPorId(id);

    if (!compra.pendiente) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.COMPRA_NO_ELIMINABLE);
    }

    await compraRepository.eliminar(id);
    return compra;
  }

  /**
   * CONFIRMAR (RN-01): suma stock de TODAS las lineas + cambia estado,
   * en UNA transaccion. Solo compras pendientes (409).
   */
  async confirmar(id) {
    const compra = await this.obtenerConDetalles(id);

    if (compra.estado !== ESTADO_COMPRA.PENDIENTE) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.COMPRA_NO_CONFIRMABLE);
    }

    await compraRepository.confirmarEnTransaccion(id, compra.detalles);
    return this.obtenerConDetalles(id);
  }

  /**
   * CANCELAR compra (queda 'anulada'). Como solo se cancelan PENDIENTES
   * (nunca sumaron stock) no hay que devolver existencias. 409 si no
   * esta pendiente.
   */
  async cancelar(id) {
    const compra = await this.obtenerPorId(id);

    if (compra.estado !== ESTADO_COMPRA.PENDIENTE) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.COMPRA_NO_ANULABLE);
    }

    await compraRepository.cambiarEstado(id, ESTADO_COMPRA.ANULADA);
    return this.obtenerPorId(id);
  }
}

// Singleton.
module.exports = new CompraService();
