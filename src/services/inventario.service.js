/**
 * src/services/inventario.service.js
 * ---------------------------------------------------------------------
 * REGLA RN-03: productos con stock_actual por debajo del stock_minimo.
 *
 * El catalogo de productos ya expone ?bajoStock=true en su listado;
 * aqui se concentra la VISTA DE ALERTA y, cuando hay productos en
 * riesgo, se emite un aviso en el log del servidor con el formato
 * exigido por C8: `fecha · nivel · mensaje · detalle`.
 *
 * Sin try/catch (R-ASYNC).
 */

const productoRepository = require('../repositories/ProductoRepository');
const { registrarAviso } = require('../middleware/logger');

class InventarioService {
  /**
   * Productos ACTIVOS por debajo de su minimo + aviso en log.
   *
   * @returns {Promise<{productos:object[], total:number, mensajeLog:string|null}>}
   */
  async alertasDeStock() {
    const productos = await productoRepository.listarBajoStock();

    if (productos.length > 0) {
      // Log con el formato C8 (fecha · nivel · mensaje · detalle).
      registrarAviso('STOCK_MINIMO_SUPERADO', {
        totalProductos: productos.length,
        productos: productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          stockActual: p.stockActual,
          stockMinimo: p.stockMinimo
        }))
      });
    }

    return {
      productos: productos.map((p) => p.toJSON()),
      total: productos.length,
      mensajeLog: productos.length > 0 ? 'STOCK_MINIMO_SUPERADO' : null
    };
  }
}

// Singleton.
module.exports = new InventarioService();
