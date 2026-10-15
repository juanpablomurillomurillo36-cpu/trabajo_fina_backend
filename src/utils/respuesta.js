/**
 * src/utils/respuesta.js
 * ---------------------------------------------------------------------
 * Traductor del CONTRATO de la API (criterio C4).
 *
 * TODA respuesta que sale de esta API tiene ESTE aspecto:
 *
 *   EXITO  : { ok: true,  mensaje: "...", datos: {...}, meta: {...} }
 *   ERROR  : { ok: false, error: { codigo, mensaje, detalles } }
 *
 * POR QUE centralizarlo aqui?
 *   Si cada controlador armarara su propio JSON, tarde o temprano uno
 *   olvidaria el campo `ok` y el frontend se romperia. Aqui se arma
 *   UNA vez y todos llaman a estas funciones.
 *
 * Este modulo es una coleccion de funciones puras: solo recibe datos y
 * devuelve/arma respuestas. No toca la base de datos ni aplica reglas
 * de negocio.
 */

/**
 * Responde 200 OK con el envoltorio de exito.
 *
 * @param {object} res       Objeto response de Express
 * @param {object} opciones
 * @param {string} opciones.mensaje  Mensaje legible para el cliente
 * @param {*}      opciones.datos    Payload (puede ser null)
 * @param {object} [opciones.meta]   Informacion de paginacion, etc.
 * @returns {object} res (para poder hacer `return respuesta.exito(...)`)
 */
function exito(res, { mensaje, datos = null, meta = null }) {
  const cuerpo = { ok: true, mensaje };

  // Solo agregamos `datos` y `meta` si vienen; asi el JSON queda limpio.
  if (datos !== null && datos !== undefined) {
    cuerpo.datos = datos;
  }

  if (meta !== null && meta !== undefined) {
    cuerpo.meta = meta;
  }

  return res.status(200).json(cuerpo);
}

/**
 * Responde 201 Created. Se usa cuando SE CREA un recurso nuevo.
 * El controlador debe poner antes la cabecera Location.
 *
 * @param {object} res
 * @param {object} opciones  Igual que exito()
 * @returns {object} res
 */
function creado(res, { mensaje, datos = null, meta = null }) {
  const cuerpo = { ok: true, mensaje };

  if (datos !== null && datos !== undefined) {
    cuerpo.datos = datos;
  }

  if (meta !== null && meta !== undefined) {
    cuerpo.meta = meta;
  }

  return res.status(201).json(cuerpo);
}

/**
 * Responde un ERROR con el envoltorio { ok: false, error: {...} }.
 *
 * OJO: si el error es interno (500) NUNCA se manda el mensaje real al
 * cliente, porque podria filtrar informacion interna (nombres de tablas,
 * rutas, etc.). Se manda un mensaje generico y el detalle queda en el
 * log del servidor.
 *
 * @param {object} res
 * @param {object} appError  Instancia de AppError
 * @returns {object} res
 */
function fallo(res, appError) {
  return res.status(appError.estado).json({
    ok: false,
    error: appError.aRespuestaError()
  });
}

/**
 * Arma el bloque `meta` de paginacion.
 *
 *   { total, pagina, limite, devueltos, totalPaginas }
 *
 * @param {object} datos
 * @returns {object|null} null si no hay nada que informar
 */
function construirMeta({ total, pagina, limite, devueltos }) {
  if (total === undefined || total === null) {
    return null;
  }

  // Math.ceil redondea hacia arriba: 45 items / 20 = 3 paginas.
  const totalPaginas = Math.ceil(total / limite);

  return {
    total,
    pagina,
    limite,
    devueltos,
    totalPaginas
  };
}

module.exports = {
  exito,
  creado,
  fallo,
  construirMeta
};
