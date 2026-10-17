/**
 * src/services/cliente.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `clientes`:
 *  - categoria obligatoria, debe EXISTIR y estar ACTIVA -> 400.
 *  - documento obligatorio y UNICO (indice de MySQL) -> 409.
 *  - fecha de nacimiento opcional, formato valido y NO futura -> 400.
 *  - es_vip acepta boolean/1/'true' (bandera de reportes VIP).
 *  - eliminar -> 409 si el cliente tiene reservas, ventas, ingresos,
 *    puntos o notificaciones (5 tablas).
 *  Precedencia: 400 -> 409. Sin try/catch (R-ASYNC).
 */

const clienteRepository = require('../repositories/ClienteRepository');
const categoriaClienteRepository = require('../repositories/CategoriaClienteRepository');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const fechas = require('../utils/fechas');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];
const MAXIMO_TELEFONO = 20;

/** Igual regla que el modelo: true/1/'1'/'true' encienden la bandera. */
function aEnteroVip(valor) {
  return valor === true || valor === 1 || valor === '1' || valor === 'true' ? 1 : 0;
}

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
  colector.exigirId('idCategoriaCliente', cuerpo?.idCategoriaCliente);
  let categoriaOk = false;
  const idCategoria = formato.aEnteroONulo(cuerpo?.idCategoriaCliente);
  if (idCategoria !== null) {
    const categoria = await categoriaClienteRepository.obtenerPorId(idCategoria);
    if (categoria === null) {
      colector.agregar('idCategoriaCliente', 'La categoria indicada no existe');
    } else if (!categoria.estaActivo()) {
      colector.agregar('idCategoriaCliente', 'La categoria indicada esta inactiva');
    } else {
      categoriaOk = true;
    }
  }
  datos.id_categoria_cliente = categoriaOk ? idCategoria : null;

  // --- nombres --------------------------------------------------------
  colector.exigirTexto('nombre', cuerpo?.nombre, { maximo: LIMITES.VARCHAR_MEDIO });
  datos.nombre = formato.limpiarTexto(cuerpo?.nombre) || '';

  colector.exigirTexto('apellido', cuerpo?.apellido, { maximo: LIMITES.VARCHAR_MEDIO });
  datos.apellido = formato.limpiarTexto(cuerpo?.apellido) || '';

  // --- documento (unico) ----------------------------------------------
  colector.exigirTexto('documento', cuerpo?.documento, { maximo: LIMITES.VARCHAR_CORTO });
  datos.documento = formato.limpiarTexto(cuerpo?.documento) || '';

  const documentoDuplicado = datos.documento !== ''
    ? await clienteRepository.existeDocumento(datos.documento, idActual)
    : false;

  // --- contacto --------------------------------------------------------
  datos.telefono = formato.limpiarTexto(cuerpo?.telefono) || null;
  if (datos.telefono && datos.telefono.length > MAXIMO_TELEFONO) {
    colector.agregar('telefono', `No puede superar ${MAXIMO_TELEFONO} caracteres`);
  }

  const email = formato.limpiarTexto(cuerpo?.email) || '';
  if (email !== '') colector.exigirCorreo('email', email);
  datos.email = email === '' ? null : email.toLowerCase();

  // --- fecha de nacimiento (opcional, jamas en el futuro) --------------
  colector.exigirFecha('fechaNacimiento', cuerpo?.fechaNacimiento, { requerido: false });
  const iso = fechas.aFechaISO(cuerpo?.fechaNacimiento);
  datos.fecha_nacimiento = iso === null ? null : iso.slice(0, 10);

  // --- VIP -------------------------------------------------------------
  datos.es_vip = aEnteroVip(cuerpo?.esVip);

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

class ClienteService {
  /** ?estado=&busqueda=&idCategoria=&esVip=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);
    const idCategoria = formato.aEnteroONulo(filtros.idCategoria);

    let esVip = null;
    if (filtros.esVip === 'true' || filtros.esVip === '1') esVip = 1;
    if (filtros.esVip === 'false' || filtros.esVip === '0') esVip = 0;

    const { total, filas } = await clienteRepository.listar({
      estado, busqueda, idCategoria, esVip, pagina, limite
    });
    return { clientes: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const cliente = await clienteRepository.obtenerPorId(id);
    if (cliente === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('cliente'));
    }
    return cliente.toJSON();
  }

  async crear(cuerpo) {
    const datos = await preparar(cuerpo);
    const id = await clienteRepository.crear(datos);
    return this.obtenerPorId(id);
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);
    const datos = await preparar(cuerpo, id, actual.estado);
    await clienteRepository.actualizar(id, datos);
    return this.obtenerPorId(id);
  }

  async cambiarEstado(id, cuerpo) {
    await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, ESTADOS_PERMITIDOS);
    colector.lanzarSiHay();

    await clienteRepository.cambiarEstado(id, cuerpo.estado);
    return this.obtenerPorId(id);
  }

  async eliminar(id) {
    const cliente = await this.obtenerPorId(id);

    const usos = await clienteRepository.contarUsos(id);
    const total = usos.reservas + usos.ventas + usos.ingresos + usos.puntos + usos.notificaciones;
    if (total > 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.EN_USO('cliente', `${total} registro(s) de reservas, ventas o fidelidad`)
      );
    }

    await clienteRepository.eliminar(id);
    return cliente;
  }
}

// Singleton.
module.exports = new ClienteService();
