/**
 * src/middleware/logger.js
 * ---------------------------------------------------------------------
 * Sistema de registro (log) de la aplicacion.
 *
 * CRITERIO C8 - RNF BACKEND
 * ---------------------------------------------------------------------
 *   La rúbrica exige un "log de errores". Este archivo lo implementa
 *   con el formato:
 *
 *      [2026-10-15 21:30:00] ERROR  · NO_PREVISTO · mensaje · detalle
 *
 *   Niveles usados (de menor a mayor gravedad):
 *      info    -> algo normal que vale la pena saber (arranque, login)
 *      aviso   -> un problema que no rompio nada (error 400/404/409)
 *      error   -> algo fallo y hay que investigarlo (500, MySQL)
 *
 * POR QUE NO un archivo .log con una libreria?
 *   Por simplicidad: por ahora se escribe en la consola con formato
 *   claro. Si el proyecto crece, aqui se cambia la implementacion sin
 *   tocar a los demas, porque todos llaman a registrarError().
 */

// ---------------------------------------------------------------------
// Colores para la terminal (solo estetica, no cambian la informacion)
// ---------------------------------------------------------------------
const COLOR = Object.freeze({
  reinicio: '\x1b[0m',
  rojo: '\x1b[31m',
  amarillo: '\x1b[33m',
  verde: '\x1b[32m',
  cian: '\x1b[36m',
  gris: '\x1b[90m'
});

// Mapa de nivel -> color, para no repetir condicionales abajo.
const COLOR_NIVEL = Object.freeze({
  info: COLOR.verde,
  aviso: COLOR.amarillo,
  error: COLOR.rojo
});

// Mapa de nivel -> texto alineado a 5 caracteres.
const ETIQUETA_NIVEL = Object.freeze({
  info: 'INFO ',
  aviso: 'AVISO',
  error: 'ERROR'
});

/**
 * Devuelve la fecha actual en "AAAA-MM-DD HH:MM:SS".
 * Se construye a mano para que SIEMPRE tenga 2 digitos, aunque el
 * sistema operativo use otro formato.
 *
 * @returns {string}
 */
function fechaActual() {
  const ahora = new Date();

  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  const hora = String(ahora.getHours()).padStart(2, '0');
  const minuto = String(ahora.getMinutes()).padStart(2, '0');
  const segundo = String(ahora.getSeconds()).padStart(2, '0');

  return `${anio}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
}

/**
 * Formatea cualquier valor adjunto para que quede legible en una sola
 * linea del log.
 *
 *   - undefined/null -> "-"
 *   - objeto/Error   -> JSON compacto (el Error se reduce a sus campos)
 *   - texto          -> tal cual
 *
 * @param {*} detalle
 * @returns {string}
 */
function formatearDetalle(detalle) {
  if (detalle === undefined || detalle === null) return '-';
  if (typeof detalle === 'string') return detalle;

  if (detalle instanceof Error) {
    return JSON.stringify({ nombre: detalle.name, mensaje: detalle.message });
  }

  try {
    return JSON.stringify(detalle);
  } catch {
    // Objeto con referencias circulares: no se puede serializar.
    return '[detalle no serializable]';
  }
}

/**
 * Registra un evento en el log con el formato oficial.
 *
 *   [fecha] NIVEL · mensaje · detalle
 *
 * @param {'info'|'aviso'|'error'} nivel
 * @param {string} mensaje    Que paso, en corto
 * @param {*}      [detalle]  Informacion adicional (objeto, texto...)
 */
function registrar(nivel, mensaje, detalle) {
  const color = COLOR_NIVEL[nivel] || COLOR.reinicio;
  const etiqueta = ETIQUETA_NIVEL[nivel] || String(nivel).toUpperCase();

  const linea =
    `${COLOR.gris}[${fechaActual()}]${COLOR.reinicio} ` +
    `${color}${etiqueta}${COLOR.reinicio} · ` +
    `${mensaje} · ` +
    `${COLOR.gris}${formatearDetalle(detalle)}${COLOR.reinicio}`;

  // console.error va al flujo STDERR (el de los errores), lo cual es
  // lo correcto: los logs de error no deberian mezclarse con la salida
  // normal del programa.
  if (nivel === 'error') {
    console.error(linea);
  } else {
    console.log(linea);
  }
}

// ---------------------------------------------------------------------
// Funciones publicas cortas: son las que usan el resto de la app.
// ---------------------------------------------------------------------

/** Registra un error (nivel error). */
function registrarError(mensaje, detalle) {
  registrar('error', mensaje, detalle);
}

/** Registra un aviso (nivel aviso). */
function registrarAviso(mensaje, detalle) {
  registrar('aviso', mensaje, detalle);
}

/** Registra un evento normal (nivel info). */
function registrarInfo(mensaje, detalle) {
  registrar('info', mensaje, detalle);
}

module.exports = {
  COLOR,
  registrar,
  registrarError,
  registrarAviso,
  registrarInfo
};
