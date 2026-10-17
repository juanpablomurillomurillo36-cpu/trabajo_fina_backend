/**
 * src/services/venta.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `ventas` (RN-09..RN-11) — COMPOSICION P4:
 * venta y lineas entran juntas o no se hace nada (transaccion).
 *
 * Reglas de la fase 41 (CRUD):
 *  - cliente obligatorio, debe EXISTIR y estar ACTIVO -> 400.
 *  - metodoPago: efectivo | tarjeta | transferencia -> 400.
 *  - detalles: al menos 1 producto ACTIVO con cantidad >= 1 -> 400.
 *  - el precio de cada linea sale SIEMPRE del catalogo (no del body).
 *  - total = suma de subtotales (base SIN IVA: el IVA y el comprobante
 *    los genera el PAGAR de la fase 42 — RN-10).
 *  - solo ventas PENDIENTES se editan o eliminan -> 409.
 *  Sin try/catch (R-ASYNC).
 */

const ventaRepository = require('../repositories/VentaRepository');
const clienteRepository = require('../repositories/ClienteRepository');
const productoRepository = require('../repositories/ProductoRepository');
const DetalleVenta = require('../models/DetalleVenta');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO_VENTA, METODO_PAGO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = Object.values(ESTADO_VENTA);
const METODOS_PERMITIDOS = Object.values(METODO_PAGO);

/**
 * Valida la cabecera y TODAS las lineas de la venta.
 *
 * Los productos se resuelven en PARALELO (Promise.all) con ids
 * unicos: un body con 10 lineas no dispara 10 selects repetidos.
 *
 * @param {object} cuerpo
 * @param {string} [estadoInicial]
 * @returns {Promise<{datos:object, detalles:DetalleVenta[]}>}
 */
async function preparar(cuerpo, estadoInicial = ESTADO_VENTA.PENDIENTE) {
  const colector = new ColectorErrores();

  // --- cliente ---------------------------------------------------------
  colector.exigirId('idCliente', cuerpo?.idCliente);
  const idCliente = formato.aEnteroONulo(cuerpo?.idCliente);
  let clienteOk = false;

  if (idCliente !== null) {
    const cliente = await clienteRepository.obtenerPorId(idCliente);
    if (cliente === null) {
      colector.agregar('idCliente', 'El cliente indicado no existe');
    } else if (!cliente.estaActivo()) {
      colector.agregar('idCliente', 'El cliente indicado esta inactivo');
    } else {
      clienteOk = true;
    }
  }

  // --- metodo de pago ---------------------------------------------------
  colector.exigirValorDeLista('metodoPago', cuerpo?.metodoPago, METODOS_PERMITIDOS);

  // --- lineas -----------------------------------------------------------
  const crudos = Array.isArray(cuerpo?.detalles) ? cuerpo.detalles : [];

  if (crudos.length === 0) {
    colector.agregar('detalles', MENSAJES.NEGOCIO.VENTA_SIN_DETALLES);
  }

  const idsProductos = [
    ...new Set(
      crudos.map((d) => formato.aEnteroONulo(d?.idProducto)).filter((id) => id !== null)
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
    if (cantidad === null || cantidad < 1 || cantidad > 999) {
      colector.agregar(`${campo}.cantidad`, 'Debe ser un entero entre 1 y 999');
    }

    // El precio NO viene del body: se toma del catalogo (fuente unica).
    if (producto !== null && producto.estaActivo() && cantidad !== null && cantidad >= 1 && cantidad <= 999) {
      detalles.push(new DetalleVenta(null, null, idProducto, cantidad, producto.precio));
    }
  });

  colector.lanzarSiHay();

  if (!clienteOk) {
    // No deberia llegar: exigirId/agregar ya lanzo. Defensa explicita.
    throw AppError.validacion('El cliente indicado no es valido');
  }

  const total = formato.redondearDosDecimales(detalles.reduce((suma, d) => suma + d.subtotal, 0));

  return {
    datos: { id_cliente: idCliente, metodo_pago: cuerpo.metodoPago, total, estado: estadoInicial },
    detalles
  };
}

class VentaService {
  /** ?estado=&idCliente=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const idCliente = formato.aEnteroONulo(filtros.idCliente);
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await ventaRepository.listar({ estado, idCliente, busqueda, pagina, limite });
    return { ventas: filas, total, pagina, limite };
  }

  /** Cabecera SIN lineas. */
  async obtenerPorId(id) {
    const venta = await ventaRepository.obtenerPorId(id);
    if (venta === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('venta'));
    }
    return venta.toJSON();
  }

  /** Cabecera CON sus lineas (lectura natural de la composicion). */
  async obtenerConDetalles(id) {
    const venta = await ventaRepository.obtenerConDetalles(id);
    if (venta === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('venta'));
    }
    return venta.toJSON();
  }

  /** Alta en transaccion: venta + lineas o nada. */
  async crear(cuerpo) {
    const { datos, detalles } = await preparar(cuerpo);
    const id = await ventaRepository.crearConDetalles(datos, detalles);
    return this.obtenerConDetalles(id);
  }

  /** Edicion en transaccion (solo pendiente). */
  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);

    if (!actual.pendiente) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.VENTA_NO_EDITABLE);
    }

    const { datos, detalles } = await preparar(cuerpo, actual.estado);
    await ventaRepository.actualizarConDetalles(id, datos, detalles);
    return this.obtenerConDetalles(id);
  }

  /** Baja fisica (solo pendiente; lineas caen en cascada). */
  async eliminar(id) {
    const venta = await this.obtenerPorId(id);

    if (!venta.pendiente) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.VENTA_NO_EDITABLE);
    }

    await ventaRepository.eliminar(id);
    return venta;
  }
}

// Singleton.
module.exports = new VentaService();
