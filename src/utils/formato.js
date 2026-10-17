/**
 * src/utils/formato.js
 * ---------------------------------------------------------------------
 * Funciones de NORMALIZACION de datos que llegan del cliente.
 *
 * Este archivo es parte de la regla R-DRY (no repetir codigo): si
 * varios services necesitan limpiar un texto o convertir un numero,
 * lo hacen llamando a la MISMA funcion de aqui.
 *
 * EL FLUJO DE UN SERVICE ES SIEMPRE:
 *   1. NORMALIZAR (este archivo)  -> limpiar y convertir
 *   2. VALIDAR     (validadores)  -> rechazar lo invalido
 *   3. INSTANCIAR  (models)       -> crear el objeto
 *   4. PERSISTIR   (repositories) -> guardar con SQL parametrizado
 *
 * IMPORTANTE: normalizamos solo lo que REALMENTE llego. Si el cliente
 * no envio un campo, no lo tocamos (eso permite las actualizaciones
 * parciales de un PUT).
 */

// ---------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------

/**
 * Elimina espacios sobrantes de los extremos y colapsa espacios dobles.
 *
 *   "  Ana   Maria  "  ->  "Ana Maria"
 *
 * @param {*} valor
 * @returns {string|null} null si el valor estaba vacio o no era texto
 */
function limpiarTexto(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') return null;

  const limpio = valor.replace(/\s+/g, ' ').trim();
  return limpio === '' ? null : limpio;
}

/**
 * Convierte a "Titulo Propio": solo la primera letra de cada palabra
 * en mayuscula.
 *
 *   "ANA maria"  ->  "Ana Maria"
 *   "jUAN PABLO" ->  "Juan Pablo"
 *
 * @param {*} valor
 * @returns {string|null}
 */
function aTituloPropio(valor) {
  const texto = limpiarTexto(valor);
  if (texto === null) return null;

  return texto
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, separador, letra) => separador + letra.toUpperCase());
}

/**
 * Convierte el texto a minusculas y lo limpia. Ideal para CORREOS,
 * donde "Ana@Correo.COM" y "ana@correo.com" son la misma direccion.
 *
 * @param {*} valor
 * @returns {string|null}
 */
function aMinusculas(valor) {
  const texto = limpiarTexto(valor);
  return texto === null ? null : texto.toLowerCase();
}

// ---------------------------------------------------------------------
// Numeros
// ---------------------------------------------------------------------

/**
 * Convierte a entero. Devuelve null si no es un numero util.
 *
 *   "15"    -> 15
 *   "15.7"  -> 15
 *   "abc"   -> null
 *   ""      -> null
 *
 * @param {*} valor
 * @returns {number|null}
 */
function aEnteroONulo(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;

  return Math.trunc(numero);
}

/**
 * Convierte a numero con decimales (precios, totales, IVA).
 * Devuelve null si no es un numero.
 *
 * Los DECIMAL de MySQL llegan como TEXTO ("1500.00") por la
 * configuracion del pool, asi que SIEMPRE hay que pasar por aqui
 * antes de hacer cualquier calculo.
 *
 * @param {*} valor
 * @returns {number|null}
 */
function aDecimalONulo(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;

  const numero = Number(String(valor).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Normaliza una hora 'HH:MM' o 'HH:MM:SS' a 'HH:MM:SS' (formato de
 * las columnas TIME de MySQL). Devuelve null si no es hora valida.
 *
 *   "18:30"    -> "18:30:00"
 *   "18:30:15" -> "18:30:15"
 *   "25:00"    -> null
 *   "mañana"   -> null
 *
 * Se comparte entre validadores.exigirHora y los services para no
 * repetir la expresion regular (DRY).
 *
 * @param {*} valor
 * @returns {string|null}
 */
function aHoraONulo(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor !== 'string') return null;

  const coincide = valor.trim().match(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
  if (!coincide) return null;

  return coincide[0].length === 5 ? `${coincide[0]}:00` : coincide[0];
}

/**
 * Redondea un decimal a 2 posiciones (dinero).
 *
 *   1500.456  ->  1500.46
 *
 * Se usa el truco de sumar y restar Number.EPSILON porque
 * (2.005).toFixed(2) da "2.00" en vez de "2.01" por el error de
 * punto flotante de JavaScript.
 *
 * @param {number} valor
 * @returns {number}
 */
function redondearDosDecimales(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Formatea un numero como moneda mexicana para mostrarlo.
 *
 *   1500  ->  "$1,500.00"
 *
 * @param {*} valor
 * @returns {string} "No disponible" si el valor no es un numero
 */
function aTextoMoneda(valor) {
  const numero = aDecimalONulo(valor);
  if (numero === null) return 'No disponible';

  return numero.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  });
}

// ---------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------

/**
 * true si el objeto esta vacio o no tiene propiedades con valor.
 *
 *   {}                 -> true
 *   { nombre: "Ana" }  -> false
 *   null               -> true
 *
 * Se usa para rechazar PUT sin cambios.
 *
 * @param {*} obj
 * @returns {boolean}
 */
function estaVacio(obj) {
  if (obj === null || obj === undefined) return true;
  if (typeof obj !== 'object') return false;

  return Object.keys(obj).length === 0;
}

/**
 * LISTA BLANCA de campos: descarta cualquier propiedad que no este
 * en `camposPermitidos`.
 *
 *   Esto impide que un cliente malicioso mande { "id_rol": 1 } o
 *   campos internos que no deberia controlar.
 *
 * Solo incluye las propiedades que REALMENTE llegaron (Object.hasOwn),
 * por eso sirve tambien para actualizaciones parciales.
 *
 * @param {object}   datos             req.body
 * @param {string[]} camposPermitidos  Lista blanca
 * @returns {object} Solo los campos permitidos que venian
 */
function soloCamposPermitidos(datos, camposPermitidos) {
  const resultado = {};

  if (datos === null || typeof datos !== 'object') {
    return resultado;
  }

  for (const campo of camposPermitidos) {
    if (Object.hasOwn(datos, campo)) {
      resultado[campo] = datos[campo];
    }
  }

  return resultado;
}

module.exports = {
  limpiarTexto,
  aTituloPropio,
  aMinusculas,
  aEnteroONulo,
  aDecimalONulo,
  aHoraONulo,
  redondearDosDecimales,
  aTextoMoneda,
  estaVacio,
  soloCamposPermitidos
};
