/**
 * src/utils/fechas.js
 * ---------------------------------------------------------------------
 * Normalizacion de fechas.
 *
 * POR QUE EXISTE?
 * Porque una fecha puede llegar desde TRES lugares distintos y cada
 * uno la trae en un formato diferente:
 *
 *   1. MySQL  -> objeto Date (o cadena "2026-10-24 21:30:00")
 *   2. JSON   -> texto ISO "2026-10-24T21:30:00.000Z"
 *   3. HTML   -> texto "24/10/2026"
 *
 * Sin una capa unificada, cada service tendria que preguntar "esto es
 * Date o string?" y el codigo se vuelve frágil.
 *
 * REGLA DE ESTA API: hacia ADENTRO (base de datos) se manda un Date de
 * JavaScript; hacia AFUERA (respuesta JSON) siempre se devuelve texto
 * ISO 8601, que es lo que entienden todos los clientes.
 */

/**
 * Convierte casi cualquier valor en un objeto Date.
 *
 * @param {*} valor
 * @returns {Date|null}  null si el valor no es interpretable.
 */
function aDate(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  if (valor instanceof Date) {
    // isNaN protege contra `new Date('basura')`, que devuelve una
    // fecha Invalida en lugar de null.
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Fecha y hora en texto ISO 8601 (con zona horaria).
 *
 * Es lo que se devuelve en las respuestas: "2026-10-24T21:30:00.000Z".
 *
 * @param {*} valor
 * @returns {string|null}
 */
function aFechaHoraISO(valor) {
  const fecha = aDate(valor);
  return fecha === null ? null : fecha.toISOString();
}

/**
 * Solo la fecha, en formato "YYYY-MM-DD".
 *
 * Se usa para columnas DATE (fecha de nacimiento, fecha del evento).
 * toISOString() devuelve tambien la hora, por eso se recorta: si la
 * hora es 23:00 en America/Bogota, "slice(0,10)" de un ISO en UTC
 * podria devolver el dia SIGUIENTE. Por eso se arma desde la fecha
 * LOCAL.
 *
 * @param {*} valor
 * @returns {string|null}
 */
function aFechaISO(valor) {
  const fecha = aDate(valor);
  if (fecha === null) return null;

  const anio = String(fecha.getFullYear()).padStart(4, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

/**
 * Convierte a un objeto Date apto para enviarlo a MySQL.
 *
 * Si llega un texto "YYYY-MM-DD" se interpreta en HORA LOCAL (y no en
 * UTC): si no, el dia escrito por el usuario se corre un dia cuando
 * la zona esta detras de UTC.
 *
 * @param {*} valor
 * @returns {Date|null}
 */
function aFechaMySQL(valor) {
  if (typeof valor === 'string') {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());

    if (coincidencia) {
      const [, anio, mes, dia] = coincidencia;
      return new Date(Number(anio), Number(mes) - 1, Number(dia));
    }
  }

  return aDate(valor);
}

/**
 * true si la fecha recibida es ANTES de "ahora".
 * Se usa para exigir, por ejemplo, fechas de nacimiento pasadas.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esFechaPasada(valor) {
  const fecha = aDate(valor);
  return fecha !== null && fecha.getTime() < Date.now();
}

/**
 * true si la fecha recibida es DESPUES de "ahora".
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esFechaFutura(valor) {
  const fecha = aDate(valor);
  return fecha !== null && fecha.getTime() > Date.now();
}

/**
 * Edad cumplida en años a partir de una fecha de nacimiento.
 * Devuelve null si la fecha no es interpretable.
 *
 * Se calcula con mes y dia y no dividiendo por 365: dividiendo por
 * 365 alguien nacido hace 18 años exactos podria aparecer como mayor
 * un dia antes de su cumpleaños.
 *
 * @param {*} nacimiento
 * @returns {number|null}
 */
function calcularEdad(nacimiento) {
  const fecha = aDate(nacimiento);
  if (fecha === null) return null;

  const hoy = new Date();

  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mes = hoy.getMonth() - fecha.getMonth();

  if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
    edad -= 1;
  }

  return edad;
}

/**
 * Fecha y hora actuales en ISO. Util para marcar auditorias.
 * @returns {string}
 */
function ahoraISO() {
  return new Date().toISOString();
}

module.exports = {
  aDate,
  aFechaISO,
  aFechaHoraISO,
  aFechaMySQL,
  esFechaPasada,
  esFechaFutura,
  calcularEdad,
  ahoraISO
};
