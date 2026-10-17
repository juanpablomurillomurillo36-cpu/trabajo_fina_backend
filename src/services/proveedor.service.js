/**
 * src/services/proveedor.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `proveedores` (capa intermedia: valida y decide;
 * NO contiene SQL).
 *
 * Reglas:
 *  - nombre es obligatorio (max 120).
 *  - nit es opcional pero, si viene, debe ser UNICO (409). Se compara
 *    contra todos los registros porque el indice `uq_proveedores_nit`
 *    lo exige a nivel de tabla (aunque el registro duplicado este
 *    inactivo, MySQL rechazaria el INSERT).
 *  - eliminar exige que el proveedor no tenga compras asociadas (409),
 *    porque `compras.id_proveedor` es FK.
 *  - Todo error se lanza con AppError y lo captura el errorHandler
 *    (aqui NUNCA se usa try/catch: R-ASYNC).
 */

const proveedorRepository = require('../repositories/ProveedorRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];

// Contacto: tamanos de las columnas del esquema.
const MAXIMO_NIT = 30;
const MAXIMO_TELEFONO = 20;
const MAXIMO_DIRECCION = 200;

/**
 * Valida y normaliza el cuerpo de un proveedor (crear/editar).
 *
 * OJO con formato.limpiarTexto: devuelve NULL cuando el valor venia
 * vacio o ausente, por eso todo se pasa por `|| ''` antes de medir
 * longitudes o comparar contra ''.
 *
 * PRECEDENCIA DE ERRORES: primero 400 (campos invalidos) y solo
 * despues 409 (NIT duplicado), para que un body malo no reporte un
 * conflicto que aun no sabemos si existe.
 *
 * @param {object} cuerpo
 * @param {number|null} [idActual] Para excluirse a si mismo en la
 *        comprobacion de NIT duplicado durante una edicion.
 * @param {string} [estadoActual] En edicion, si el body no trae estado
 *        se conserva el actual (no se reactiva un registro por accidente).
 * @returns {Promise<object>} datos listos para el repository.
 */
async function preparar(cuerpo, idActual = null, estadoActual = ESTADO.ACTIVO) {
  const colector = new ColectorErrores();
  const datos = {};

  // --- nombre (obligatorio) -----------------------------------------
  colector.exigirTexto('nombre', cuerpo?.nombre, {
    maximo: LIMITES.VARCHAR_LARGO
  });
  datos.nombre = formato.limpiarTexto(cuerpo?.nombre) || '';

  // --- nit (opcional, unico si viene) --------------------------------
  const nit = formato.limpiarTexto(cuerpo?.nit) || '';
  let nitDuplicado = false;
  if (nit !== '') {
    if (nit.length > MAXIMO_NIT) {
      colector.agregar('nit', `No puede superar ${MAXIMO_NIT} caracteres`);
    } else {
      // Se consulta ANTES de lanzar la validacion para no quemar una
      // consulta si el body ya esta malo.
      nitDuplicado = await proveedorRepository.existeNit(nit, idActual);
    }
  }
  datos.nit = nit === '' ? null : nit;

  // --- telefono ------------------------------------------------------
  datos.telefono = formato.limpiarTexto(cuerpo?.telefono) || null;
  if (datos.telefono && datos.telefono.length > MAXIMO_TELEFONO) {
    colector.agregar('telefono', `No puede superar ${MAXIMO_TELEFONO} caracteres`);
  }

  // --- email (opcional, formato valido si viene) ---------------------
  const email = formato.limpiarTexto(cuerpo?.email) || '';
  if (email !== '') colector.exigirCorreo('email', email);
  datos.email = email === '' ? null : email.toLowerCase();

  // --- direccion -----------------------------------------------------
  datos.direccion = formato.limpiarTexto(cuerpo?.direccion) || null;
  if (datos.direccion && datos.direccion.length > MAXIMO_DIRECCION) {
    colector.agregar('direccion', `No puede superar ${MAXIMO_DIRECCION} caracteres`);
  }

  // --- estado --------------------------------------------------------
  if (cuerpo?.estado !== undefined) {
    colector.exigirValorDeLista('estado', cuerpo.estado, ESTADOS_PERMITIDOS);
    datos.estado = cuerpo.estado;
  } else {
    datos.estado = estadoActual;
  }

  // 400 primero...
  colector.lanzarSiHay();

  // ...409 despues: el NIT es un indice unico de MySQL.
  if (nitDuplicado) {
    throw AppError.conflicto(MENSAJES.NEGOCIO.NIT_DUPLICADO(nit), [
      { campo: 'nit', mensaje: MENSAJES.NEGOCIO.NIT_DUPLICADO(nit) }
    ]);
  }

  return datos;
}

class ProveedorService {
  /**
   * LISTAR proveedores con filtros y paginacion.
   *
   * Filtros admitidos: ?estado=&busqueda=&pagina=&limite=
   *
   * @param {object} filtros  req.query
   * @returns {Promise<{proveedores:object[], total, pagina, limite}>}
   */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await proveedorRepository.listar({
      estado,
      busqueda,
      pagina,
      limite
    });

    return { proveedores: filas, total, pagina, limite };
  }

  /**
   * OBTENER un proveedor por id.
   *
   * @param {number} id
   * @returns {Promise<object>} JSON del proveedor
   * @throws {AppError} 404 si no existe.
   */
  async obtenerPorId(id) {
    const proveedor = await proveedorRepository.obtenerPorId(id);
    if (proveedor === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('proveedor'));
    }
    return proveedor.toJSON();
  }

  /**
   * CREAR proveedor (400 validacion, 409 NIT duplicado).
   */
  async crear(cuerpo) {
    const datos = await preparar(cuerpo);

    const id = await proveedorRepository.crear(datos);
    return this.obtenerPorId(id);
  }

  /**
   * ACTUALIZAR proveedor (404 si no existe, 409 NIT de otro registro).
   */
  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);

    const datos = await preparar(cuerpo, id, actual.estado);
    await proveedorRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  /**
   * CAMBIAR ESTADO (activo/inactivo).
   */
  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await proveedorRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  /**
   * ELIMINAR proveedor. Se bloquea (409) si tiene compras asociadas:
   * borrarlo romperia la integridad referencial de `compras.id_proveedor`.
   */
  async eliminar(id) {
    const proveedor = await this.obtenerPorId(id);

    const totalCompras = await proveedorRepository.contarCompras(id);
    if (totalCompras > 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.EN_USO('proveedor', `${totalCompras} compra(s)`)
      );
    }

    await proveedorRepository.eliminar(id);
    return proveedor;
  }
}

// Singleton: una sola instancia para toda la app.
module.exports = new ProveedorService();
