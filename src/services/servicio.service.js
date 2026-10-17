/**
 * src/services/servicio.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `servicios` (C-02: nombre unico entre activos
 * controlado aqui, no por indice de MySQL).
 *
 *  - nombre obligatorio (max 120), unico entre activos -> 409.
 *  - precio obligatorio >= 0.
 *  - eliminar -> 409 si esta en detalle_reserva, agenda_empleados o
 *    ficha_servicio.
 *  Sin try/catch: R-ASYNC.
 */

const servicioRepository = require('../repositories/ServicioRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];

/**
 * Precedencia: 400 (campos) -> 409 (nombre duplicado).
 *
 * @param {object} cuerpo
 * @param {number|null} [idActual]
 * @param {string} [estadoActual]
 * @returns {Promise<object>} datos snake_case.
 */
async function preparar(cuerpo, idActual = null, estadoActual = ESTADO.ACTIVO) {
  const colector = new ColectorErrores();
  const datos = {};

  colector.exigirTexto('nombre', cuerpo?.nombre, { maximo: LIMITES.VARCHAR_LARGO });
  datos.nombre = formato.limpiarTexto(cuerpo?.nombre) || '';

  const nombreDuplicado = datos.nombre !== ''
    ? await servicioRepository.existeNombre(datos.nombre, idActual)
    : false;

  colector.exigirTexto('descripcion', cuerpo?.descripcion, {
    requerido: false,
    maximo: LIMITES.VARCHAR_DESCRIPCION
  });
  datos.descripcion = formato.limpiarTexto(cuerpo?.descripcion) || null;

  colector.exigirDecimal('precio', cuerpo?.precio, { requerido: true, minimo: 0 });
  datos.precio = formato.aDecimalONulo(cuerpo?.precio) ?? 0;

  if (cuerpo?.estado !== undefined) {
    colector.exigirValorDeLista('estado', cuerpo.estado, ESTADOS_PERMITIDOS);
    datos.estado = cuerpo.estado;
  } else {
    datos.estado = estadoActual;
  }

  colector.lanzarSiHay();

  if (nombreDuplicado) {
    throw AppError.conflicto(MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('servicio', datos.nombre), [
      { campo: 'nombre', mensaje: MENSAJES.NEGOCIO.NOMBRE_DUPLICADO('servicio', datos.nombre) }
    ]);
  }

  return datos;
}

class ServicioService {
  /** ?estado=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await servicioRepository.listar({ estado, busqueda, pagina, limite });
    return { servicios: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const servicio = await servicioRepository.obtenerPorId(id);
    if (servicio === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('servicio'));
    }
    return servicio.toJSON();
  }

  async crear(cuerpo) {
    const datos = await preparar(cuerpo);
    const id = await servicioRepository.crear(datos);
    return this.obtenerPorId(id);
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = await preparar(cuerpo, id, actual.estado);
    await servicioRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await servicioRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  async eliminar(id) {
    const servicio = await this.obtenerPorId(id);

    const usos = await servicioRepository.contarUsos(id);
    const total = usos.reservas + usos.agenda + usos.fichas;
    if (total > 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.EN_USO('servicio', `${total} registro(s) de reservas, agenda o fichas`)
      );
    }

    await servicioRepository.eliminar(id);
    return servicio;
  }
}

// Singleton.
module.exports = new ServicioService();
