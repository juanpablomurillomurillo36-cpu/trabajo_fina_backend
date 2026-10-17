/**
 * src/services/ficha-tecnica.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `ficha_tecnica` + `ficha_servicio` (RN-07):
 *  - COMPOSICION 1:1: un evento tiene COMO MAXIMO UNA ficha -> crear
 *    dos veces = 409 FICHA_DUPLICADA (uq_ficha_evento).
 *  - sin ficha, GET/PUT/DELETE responden 409 EVENTO_SIN_FICHA.
 *  - la ficha y su N:N de servicios se guardan JUNTAS o no se hace
 *    nada (transaccion; el PUT reemplaza el listado entero).
 *  - cada servicio del N:N debe EXISTIR y estar ACTIVO; cantidad
 *    requerida >= 1 -> 400.
 *  - cantidadInvitados >= 0 (default 0); textos segun columna.
 *  - el evento referenciado debe existir -> 404 (llega del path).
 *  Sin try/catch (R-ASYNC).
 */

const fichaTecnicaRepository = require('../repositories/FichaTecnicaRepository');
const eventoRepository = require('../repositories/EventoRepository');
const servicioRepository = require('../repositories/ServicioRepository');
const FichaServicio = require('../models/FichaServicio');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const { ColectorErrores } = require('../utils/validadores');

// Columnas de la tabla.
const MAXIMO_TEMATICA = 150;
const MAXIMO_FRANJA = 60;
const MAXIMO_OBSERVACIONES = 255;

/**
 * Valida la cabecera de la ficha y su N:N de servicios.
 *
 * @param {object} cuerpo
 * @returns {Promise<{filaFicha:object, servicios:FichaServicio[]}>}
 */
async function preparar(cuerpo) {
  const colector = new ColectorErrores();

  colector.exigirTexto('tematica', cuerpo?.tematica, { requerido: false, maximo: MAXIMO_TEMATICA });
  colector.exigirTexto('franjaHoraria', cuerpo?.franjaHoraria, { requerido: false, maximo: MAXIMO_FRANJA });
  colector.exigirTexto('observaciones', cuerpo?.observaciones, {
    requerido: false,
    maximo: MAXIMO_OBSERVACIONES
  });

  // 0 invitados tambien es valido: el rango completo lo cubren
  // minimo Y maximo (regla del ColectorErrores).
  if (cuerpo?.cantidadInvitados !== undefined && cuerpo.cantidadInvitados !== null && cuerpo.cantidadInvitados !== '') {
    colector.exigirEntero('cantidadInvitados', cuerpo.cantidadInvitados, {
      requerido: true,
      minimo: 0,
      maximo: 2147483647
    });
  }

  const crudos = Array.isArray(cuerpo?.servicios) ? cuerpo.servicios : [];

  // Servicios distintos -> una sola tanda de consultas en paralelo.
  const idsServicios = [
    ...new Set(
      crudos.map((s) => formato.aEnteroONulo(s?.idServicio)).filter((id) => id !== null)
    )
  ];
  const consultas = await Promise.all(
    idsServicios.map((id) => servicioRepository.obtenerPorId(id))
  );
  const mapaServicios = new Map(idsServicios.map((id, i) => [id, consultas[i]]));

  const servicios = [];

  crudos.forEach((linea, i) => {
    const campo = `servicios[${i}]`;
    const idServicio = formato.aEnteroONulo(linea?.idServicio);
    const servicio = idServicio !== null ? mapaServicios.get(idServicio) : null;

    if (idServicio === null) {
      colector.agregar(`${campo}.idServicio`, 'Debe ser un id de servicio valido');
    } else if (servicio === null || !servicio.estaActivo()) {
      colector.agregar(`${campo}.idServicio`, 'El servicio indicado no existe o esta inactivo');
    }

    const cantidad = formato.aEnteroONulo(linea?.cantidadRequerida);
    if (cantidad !== null && (cantidad < 1 || cantidad > 999)) {
      colector.agregar(`${campo}.cantidadRequerida`, 'Debe ser un entero entre 1 y 999');
    }

    // Si no mandan cantidad, manda el default 1 de la columna.
    const cantidadFinal = cantidad === null ? 1 : cantidad;
    const esValida = idServicio !== null && servicio !== null && servicio.estaActivo() && cantidadFinal >= 1;

    if (esValida) {
      const par = new FichaServicio(null, idServicio, cantidadFinal);
      // Repetir el mismo servicio en dos lineas violaria la PK
      // compuesta: se queda solo la ultima cantidad.
      const posicion = servicios.findIndex((s) => s.idServicio === idServicio);
      if (posicion >= 0) servicios[posicion] = par;
      else servicios.push(par);
    }
  });

  colector.lanzarSiHay();

  const invitados = formato.aEnteroONulo(cuerpo?.cantidadInvitados) ?? 0;

  const filaFicha = {
    tematica: formato.limpiarTexto(cuerpo?.tematica) || null,
    franja_horaria: formato.limpiarTexto(cuerpo?.franjaHoraria) || null,
    cantidad_invitados: invitados,
    observaciones: formato.limpiarTexto(cuerpo?.observaciones) || null
  };

  return { filaFicha, servicios };
}

class FichaTecnicaService {
  /** Resuelve el evento del path: 404 si no existe. */
  async #evento(idEvento) {
    const evento = await eventoRepository.obtenerPorId(idEvento);
    if (evento === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('evento'));
    }
    return evento;
  }

  async obtenerPorEvento(idEvento) {
    await this.#evento(idEvento);

    const ficha = await fichaTecnicaRepository.obtenerPorEvento(idEvento);
    if (ficha === null) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.EVENTO_SIN_FICHA);
    }
    return ficha.toJSON();
  }

  /** Alta de la composicion 1:1 (+ N:N) o 409 si ya existia. */
  async crear(idEvento, cuerpo) {
    await this.#evento(idEvento);

    if (await fichaTecnicaRepository.existePorEvento(idEvento)) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.FICHA_DUPLICADA);
    }

    const { filaFicha, servicios } = await preparar(cuerpo);
    await fichaTecnicaRepository.crearConServicios({ ...filaFicha, id_evento: idEvento }, servicios);
    return this.obtenerPorEvento(idEvento);
  }

  /** Edicion completa: cabecera + reemplazo total del N:N. */
  async actualizar(idEvento, cuerpo) {
    await this.#evento(idEvento);

    const actual = await fichaTecnicaRepository.obtenerPorEvento(idEvento);
    if (actual === null) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.EVENTO_SIN_FICHA);
    }

    const { filaFicha, servicios } = await preparar(cuerpo);
    await fichaTecnicaRepository.actualizarConServicios(actual.id, filaFicha, servicios);
    return this.obtenerPorEvento(idEvento);
  }

  async eliminar(idEvento) {
    await this.#evento(idEvento);

    const actual = await fichaTecnicaRepository.obtenerPorEvento(idEvento);
    if (actual === null) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.EVENTO_SIN_FICHA);
    }

    await fichaTecnicaRepository.eliminar(actual.id);
    return actual.toJSON();
  }
}

// Singleton.
module.exports = new FichaTecnicaService();
