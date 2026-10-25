/**
 * src/utils/respuesta.js
 * ---------------------------------------------------------------------
 * Constructor del "sobre" (envelope) de respuesta de la API.
 *
 * POR QUE UN FORMATO UNICO DE RESPUESTA?
 * Porque el frontend necesita un contrato ESTABLE. Si cada endpoint
 * responde distinto, el codigo del cliente se llena de condicionales.
 * Con este sobre, basta `if (respuesta.ok)`.
 *
 * CONTRATO DE ESTA API
 *
 *   Exito (200 / 201):
 *   {
 *     "ok": true,
 *     "mensaje": "Registro creado correctamente",
 *     "datos": { ... }  o  [ ... ],
 *     "meta": { "total": 5, "pagina": 1, "limite": 20 }   <- opcional
 *   }
 *
 *   Error (400, 404, 409, 500...):
 *   {
 *     "ok": false,
 *     "error": {
 *       "codigo": "NO_ENCONTRADO",
 *       "mensaje": "No existe el rol con id 999",
 *       "detalles": [ { "campo": "email", "mensaje": "..." } ]
 *     }
 *   }
 *
 * La bandera "ok" permite decidir sin interpretar el codigo HTTP.
 */

const { HTTP } = require('./constants');

/**
 * Envia una respuesta exitosa.
 *
 * @param {import('express').Response} res  Objeto response de Express.
 * @param {object} opciones
 * @param {number} opciones.estado    Codigo HTTP (defecto 200).
 * @param {string} opciones.mensaje   Texto para el usuario.
 * @param {*}      opciones.datos     Carga util (objeto o arreglo).
 * @param {object} opciones.meta      Metadatos opcionales (paginacion).
 */
function exito(res, { estado = HTTP.OK, mensaje = '', datos = null, meta = null } = {}) {
  const cuerpo = { ok: true, mensaje };

  // "datos" va SIEMPRE, aunque sea null, para que el frontend pueda
  // hacer respuesta.datos.map(...) sin preguntar antes si existe.
  cuerpo.datos = datos;

  // "meta" solo aparece cuando tiene sentido (listados paginados).
  if (meta !== null) {
    cuerpo.meta = meta;
  }

  return res.status(estado).json(cuerpo);
}

/**
 * Atajo para respuestas 201 Created (resultado de un POST).
 *
 * Se usa 201 y no 200 porque 201 indica "un recurso nuevo fue creado".
 * El estandar HTTP lo distingue expressamente y los clientes REST
 * (como Postman) lo verifican con pm.response.to.have.status(201).
 *
 * @param {import('express').Response} res
 * @param {object} opciones
 */
function creado(res, { mensaje = '', datos = null } = {}) {
  return exito(res, { estado: HTTP.CREADO, mensaje, datos });
}

/**
 * Envia una respuesta de error ya formateada.
 *
 * Normalmente NO se llama directo: es el middleware manejadorErrores
 * quien la usa. Se deja exportada por si una capa necesita responder
 * un error sin lanzar una excepcion.
 *
 * @param {import('express').Response} res
 * @param {object} opciones
 */
function error(res, { estado = HTTP.ERROR_INTERNO, codigo = 'INTERNO', mensaje = '', detalles = [] } = {}) {
  const cuerpo = { ok: false, error: { codigo, mensaje } };

  // "detalles" solo aparece si aporta informacion: no tiene sentido
  // enviar "detalles": [] y obligar al cliente a comprobar longitud.
  if (Array.isArray(detalles) && detalles.length > 0) {
    cuerpo.error.detalles = detalles;
  }

  return res.status(estado).json(cuerpo);
}

/**
 * Construye el objeto "meta" de un listado paginado.
 *
 * @param {object} opciones
 * @param {number} opciones.total     Total de registros que cumplen el filtro.
 * @param {number} opciones.pagina    Pagina solicitada.
 * @param {number} opciones.limite    Registros por pagina.
 * @param {number} opciones.devueltos Registros en ESTA respuesta.
 * @returns {object}
 */
function construirMeta({ total, pagina, limite, devueltos }) {
  // Math.ceil redondea hacia arriba: 11 registros de 5 en 5 -> 3 paginas.
  const totalPaginas = limite > 0 ? Math.ceil(total / limite) : 0;

  return {
    total,
    pagina,
    limite,
    devueltos,
    totalPaginas,
    hayPaginaSiguiente: pagina < totalPaginas,
    hayPaginaAnterior: pagina > 1
  };
}

module.exports = { exito, creado, error, construirMeta };
