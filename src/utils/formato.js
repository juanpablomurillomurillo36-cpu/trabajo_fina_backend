/**
 * src/utils/formato.js
 * ---------------------------------------------------------------------
 * Helpers de formato "sin estado": funciones puras que reciben algo y
 * devuelven otra cosa, sin tocar la base de datos ni HTTP.
 *
 * Estan separadas de los validadores porque NO rechazan: aqui solo se
 * NORMALIZA. En validadores.js, en cambio, se rechaza lo malo.
 */

/**
 * Recorta espacios al inicio y al final y colapsa los espacios
 * internos dobles.
 *
 * "  Maria   Jose  "  ->  "Maria Jose"
 *
 * @param {*} valor
 * @returns {string}
 */
function limpiarTexto(valor) {
  if (typeof valor !== 'string') return valor;

  return valor.replace(/\s+/g, ' ').trim();
}

/**
 * Convierte a formato Titulo: "juan carlos perez" -> "Juan Carlos Perez".
 *
 * Se aplica SOLO a nombres propios. Nunca a correos, contrasenas ni
 * codigos, porque alli las mayusculas son significativas.
 *
 * @param {*} valor
 * @returns {string}
 */
function aTituloPropio(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') return valor;

  return limpiarTexto(valor)
    .toLowerCase()
    .replace(/(^|\s)([a-záéíóúñ])/g, (coincidencia, espacio, letra) => `${espacio}${letra.toUpperCase()}`);
}

/**
 * Convierte a entero si es posible; si no, devuelve null.
 *
 * "12"   -> 12
 * 12     -> 12
 * "12.7" -> 12      (Math.trunc corta los decimales)
 * "abc"  -> null
 * 3.99   -> 3
 *
 * @param {*} valor
 * @returns {number|null}
 */
function aEnteroONulo(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  const numero = typeof valor === 'number' ? valor : Number.parseFloat(valor);

  if (Number.isNaN(numero)) return null;

  return Math.trunc(numero);
}

/**
 * Interpreta valores "booleanos" que llegan como texto desde una
 * query string (?activo=true).
 *
 * "true" | "1" | "si"  -> true
 * "false" | "0" | "no" -> false
 * cualquier otra cosa   -> el valorPorDefecto
 *
 * @param {*} valor
 * @param {boolean} valorPorDefecto
 * @returns {boolean}
 */
function aBanderaEntera(valor, valorPorDefecto = false) {
  if (typeof valor === 'boolean') return valor;

  const texto = String(valor ?? '').trim().toLowerCase();

  if (['true', '1', 'si', 'sí', 'yes', 'on'].includes(texto)) return true;
  if (['false', '0', 'no', 'off'].includes(texto)) return false;

  return valorPorDefecto;
}

/**
 * Devuelve SOLO las llaves de `origen` que estan permitidas.
 *
 * POR QUE ES DEFENSA Y NO COMODIDAD?
 * El cuerpo de una peticion lo escribe CUALQUIERA. Si al service le
 * llegara `{"nombre":"x", "id_rol": 5, "fecha_creacion": "..."}` y se
 * pasara tal cual al UPDATE, un cliente podria cambiar campos que no
 * deberia (por ejemplo su propio rol). Filtrando aqui, lo que no este
 * en la lista simplemente se ignora.
 *
 * @param {object} origen
 * @param {string[]} permitidas
 * @returns {object}
 */
function soloCamposPermitidos(origen, permitidas) {
  if (origen === null || typeof origen !== 'object') return {};

  const salida = {};

  for (const llave of permitidas) {
    if (Object.prototype.hasOwnProperty.call(origen, llave)) {
      salida[llave] = origen[llave];
    }
  }

  return salida;
}

/**
 * true si el valor no aporta nada: null, undefined, cadena vacia o
 * solo espacios, o arreglo vacio.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function estaVacio(valor) {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  if (Array.isArray(valor)) return valor.length === 0;

  return false;
}

/**
 * Convierte la query string de paginacion en numeros sanos.
 *
 *   ?pagina=abc   -> pagina 1
 *   ?pagina=0     -> pagina 1
 *   ?limite=9999  -> limite 100   (tope duro, para no tumbar la base)
 *   no viene nada  -> 1 y 20
 *
 * POR QUE NORMALIZAR AQUI?
 * Porque `req.query` trae TODO como texto y lo escribe cualquiera.
 * Interpolar `LIMIT ${req.query.limite}` en SQL seria una inyeccion
 * directa. Con esta funcion lo unico que llega al SQL es un entero ya
 * recortado dentro del rango permitido.
 *
 * @param {object} filtros  Tipicamente req.query
 * @param {number} defectoLimite
 * @param {number} maximoLimite
 * @returns {{pagina:number, limite:number, desplazamiento:number}}
 */
function normalizarPaginacion(filtros = {}, defectoLimite = 20, maximoLimite = 100) {
  const paginaBruta = Number.parseInt(filtros.pagina, 10);
  const limiteBruto = Number.parseInt(filtros.limite, 10);

  const pagina = Number.isNaN(paginaBruta) || paginaBruta < 1 ? 1 : paginaBruta;
  const limite =
    Number.isNaN(limiteBruto) || limiteBruto < 1
      ? defectoLimite
      : Math.min(limiteBruto, maximoLimite);

  return {
    pagina,
    limite,
    desplazamiento: (pagina - 1) * limite
  };
}

module.exports = {
  limpiarTexto,
  aTituloPropio,
  aEnteroONulo,
  aBanderaEntera,
  soloCamposPermitidos,
  estaVacio,
  normalizarPaginacion
};
