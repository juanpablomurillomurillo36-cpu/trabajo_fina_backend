/**
 * src/utils/fechas.js
 * ---------------------------------------------------------------------
 * Funciones de fecha y hora.
 *
 * FORMATOS QUE USA ESTE PROYECTO
 *
 *   ISO corto (fecha)      "2026-10-15"         -> datos del cliente
 *   ISO largo (fecha/hora) "2026-10-15T21:30:00"-> intervalos
 *   MySQL                  "2026-10-15 21:30:00"-> columnas DATETIME
 *
 * TRES CUIDADOS IMPORTANTES
 *
 *   1. Nunca comparar fechas con texto. "2026-10-5" < "2026-10-15"
 *      porque el 5 es menor que el 1... solo si se comparan IGUAL, y
 *      los meses sin cero a la izquierda rompen eso. Se comparan
 *      objetos Date o timestamps numericos.
 *
 *   2. `new Date("2026-10-15")` en JavaScript se interpreta en UTC,
 *      no en la hora local. Por eso parseamos y construimos a mano.
 *
 *   3. El pool de MySQL devuelve DATETIME como objeto Date con la
 *      zona horaria del servidor (timezone: 'local' en database.js).
 */

/**
 * Convierte cualquier valor a fecha ISO corta "AAAA-MM-DD".
 *
 * @param {*} valor  Puede ser texto "2026-10-15", objeto Date o null
 * @returns {string|null} null si no se pudo convertir
 */
function aFechaISO(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  // Si ya viene en el formato justo, no hay que tocar nada.
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    return valor.trim();
  }

  const fecha = valor instanceof Date ? valor : new Date(valor);

  // getTime() devuelve NaN si la fecha no es valida.
  if (Number.isNaN(fecha.getTime())) return null;

  // getFullYear/getMonth/getDay son metodos en zona LOCAL, asi que la
  // fecha que se imprime es la que el usuario espera ver.
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

/**
 * Convierte a fecha y hora ISO "AAAA-MM-DDTHH:MM:SS".
 * Se usa para los intervalos de reservas y agendas.
 *
 * @param {*} valor
 * @returns {string|null}
 */
function aFechaHoraISO(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  const hora = String(fecha.getHours()).padStart(2, '0');
  const minuto = String(fecha.getMinutes()).padStart(2, '0');
  const segundo = String(fecha.getSeconds()).padStart(2, '0');

  return `${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
}

/**
 * Convierte al formato que espera MySQL en una columna DATETIME:
 *   "2026-10-15 21:30:00"
 *
 * @param {*} valor
 * @returns {string|null}
 */
function aFechaMySQL(valor) {
  const iso = aFechaHoraISO(valor);
  if (iso === null) return null;

  return iso.replace('T', ' ');
}

/**
 * La fecha/hora recibida es posterior a la actual?
 *
 * @param {*} valor
 * @returns {boolean} false si no se pudo interpretar
 */
function esFutura(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return false;

  return fecha.getTime() > Date.now();
}

/**
 * La fecha recibida es anterior a la actual?
 * Sirve para rechazar reservas o eventos en el pasado.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esPasada(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return false;

  return fecha.getTime() < Date.now();
}

/**
 * Devuelve la fecha y hora en formato MySQL.
 * Se usa en la bitacora y en registros con DEFAULT CURRENT_TIMESTAMP.
 *
 * @param {Date} [fecha=new Date()]  Opcional: para fechas futuras
 *   (ej. "ahora + 15 min" como vencimiento de un codigo).
 * @returns {string} "2026-10-15 21:30:00"
 */
function ahoraEnMySQL(fecha = new Date()) {
  return aFechaMySQL(fecha);
}

/**
 * ===================================================================
 * DETECTOR DE SOLAPE DE HORARIOS
 * ===================================================================
 *
 * RN-02 (reservas) y RN-08 (agenda de eventos) dicen que NO puede
 * haber dos reservas en la misma hora y espacio. Este bloque esta en
 * utils por la regla R-DRY: se usa en dos places distintos.
 *
 * DOS INTERVALOS SE SOLAPAN SI:
 *
 *      inicio1 < fin2   Y   inicio2 < fin1
 *
 * EJEMPLOS (horas):
 *
 *   21:00-23:00  y  22:00-00:00  -> SI se solapan (21<00 y 22<23)
 *   21:00-23:00  y  23:00-01:00  -> NO  (se tocan en 23:00, sin
 *                                     traslape: el primero termina
 *                                     justo cuando empieza el otro)
 *
 * @param {string} inicio1  Inicio del primer intervalo
 * @param {string} fin1     Fin del primer intervalo
 * @param {string} inicio2  Inicio del segundo intervalo
 * @param {string} fin2     Fin del segundo intervalo
 * @returns {boolean} true si hay traslape real
 */
function haySolapeHorario(inicio1, fin1, inicio2, fin2) {
  const a1 = new Date(inicio1).getTime();
  const b1 = new Date(fin1).getTime();
  const a2 = new Date(inicio2).getTime();
  const b2 = new Date(fin2).getTime();

  // Si alguna fecha no se pudo interpretar, no arriesgamos: mejor no
  // detectar un conflicto falso. La validacion de formato ocurre antes.
  if ([a1, b1, a2, b2].some((t) => Number.isNaN(t))) {
    return false;
  }

  return a1 < b2 && a2 < b1;
}

module.exports = {
  aFechaISO,
  aFechaHoraISO,
  aFechaMySQL,
  esFutura,
  esPasada,
  ahoraEnMySQL,
  haySolapeHorario
};
