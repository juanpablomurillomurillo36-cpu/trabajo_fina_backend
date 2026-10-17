/**
 * src/utils/consulta.js
 * ---------------------------------------------------------------------
 * Utilidades compartidas para armar consultas SQL.
 *
 * POR QUE EXISTE ESTE ARCHIVO?  (regla R-DRY)
 * ---------------------------------------------------------------------
 *   Todos los repositories de la API necesitan lo mismo: filtrar por
 *   campos opcionales y paginar. Son 20+ repositories; si cada uno
 *   escribiera su propio `WHERE` a mano, habria 20 versiones casi
 *   identicas y un error se repetiria 20 veces.
 *
 * SEGURIDAD: EL PUNTO MAS IMPORTANTE
 * ---------------------------------------------------------------------
 *   El `WHERE` NO se puede construir concatenando texto:
 *
 *      MAL : `SELECT * FROM permisos WHERE estado = '${estado}"`
 *      BIEN: 'SELECT * FROM permisos WHERE estado = ?' + [estado]
 *
 *   En la version mala, si estado vale "' OR 1=1 --" el atacante
 *   limpia la condicion y lee toda la tabla: INYECCION SQL.
 *
 *   La clase Filtros garantiza que SOLO la estructura de la clausula
 *   (que escribe el programador) se concatena, y los VALORES siempre
 *   viajan aparte, en el arreglo de parametros, como marcadores `?`.
 */

/**
 * Construye una clausula WHERE de forma segura y encadenable.
 *
 * USO (patron fluent: se pueden encadenar llamadas):
 *
 *   const filtros = new Filtros();
 *   filtros
 *     .agregarSi(estado, 'estado = ?', estado)
 *     .agregarBusqueda('nombre_permiso', busqueda);
 *
 *   const filas = await db.ejecutar(
 *     `SELECT * FROM permisos ${filtros.obtenerWhere()} ORDER BY ...`,
 *     filtros.obtenerParametros()
 *   );
 *
 * Si no se agrego ningun filtro, obtenerWhere() devuelve '' (sin la
 * palabra WHERE), asi que la consulta no queda sintacticamente rota.
 */
class Filtros {
  // Atributos privados: nadie desde afuera puede meter parametros
  // directos al SQL sin pasar por los metodos.
  #clausulas;
  #parametros;

  constructor() {
    this.#clausulas = [];
    this.#parametros = [];
  }

  // ---------------------------- Getters ----------------------------

  /** Cantidad de filtros agregados. */
  get cantidad() {
    return this.#clausulas.length;
  }

  /** true si no hay ningun filtro. */
  get estaVacio() {
    return this.#clausulas.length === 0;
  }

  // --------------------------- Agregados ---------------------------

  /**
   * Agrega una condicion SIEMPRE.
   *
   * @param {string} clausula    Condicion con marcadores ?, ej. "estado = ?"
   * @param {...*}   valores     Un valor por cada ? de la clausula
   * @returns {Filtros} this, para encadenar.
   */
  agregar(clausula, ...valores) {
    this.#clausulas.push(clausula);
    this.#parametros.push(...valores);
    return this;
  }

  /**
   * Agrega una condicion SOLO si la condicion de negocio se cumple.
   *
   * Es lo que permite que los filtros sean opcionales sin escribir un
   * bloque if por cada columna:
   *
   *   filtros.agregarSi(estado, 'estado = ?', estado);
   *
   * Si `estado` viene null/undefined/vacio, no se agrega nada y el
   * listado devuelve todos los registros.
   *
   * @param {*}      condicion   Si es falsa, no se agrega la clausula.
   * @param {string} clausula
   * @param {...*}   valores
   * @returns {Filtros} this
   */
  agregarSi(condicion, clausula, ...valores) {
    if (condicion) {
      this.agregar(clausula, ...valores);
    }
    return this;
  }

  /**
   * Agrega un filtro de busqueda de texto (LIKE) con la columna ya
   * validada.
   *
   * CENTRALIZA DOS COSAS QUE ES FACIL OLVIDAR:
   *   1. El formato `%texto%` para que encuentre coincidencias en
   *      cualquier parte del nombre.
   *   2. El escapado de los caracteres especiales del LIKE: si el
   *      usuario busca "100%" o "a_b", sin escaparlos significarian
   *      "cualquier cosa" y devolverian filas de mas.
   *
   * @param {string} columna  Nombre de columna VALIDADO por codigo (nunca
   *                          llega del cliente; ver la guarda de abajo).
   * @param {string|null} texto  Texto que busca el usuario.
   * @returns {Filtros} this
   */
  agregarBusqueda(columna, texto) {
    const termino = typeof texto === 'string' ? texto.trim() : '';

    if (termino === '') {
      return this;
    }

    // Guarda defensiva: la columna se escribe en el SQL, asi que SIEMPRE
    // debe ser literal de codigo. Si algun dia alguien pasa aqui un dato
    // del cliente, el error se detecta de inmediato y no hay inyeccion.
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columna)) {
      throw new Error(`Columna de busqueda no valida: ${columna}`);
    }

    return this.agregar(`${columna} LIKE ?`, `%${this.#escapar(termino)}%`);
  }

  /**
   * Busqueda de texto en VARIAS columnas a la vez (OR).
   *
   * Ejemplo: buscar un usuario escribiendo nombre, apellido o correo
   * en un solo campo de busqueda.
   *
   *   filtros.agregarBusquedaMulti(['nombre', 'apellido', 'email'], q);
   *   // -> (nombre LIKE ? OR apellido LIKE ? OR email LIKE ?)
   *
   * Se construye UNA sola clausula entre parentesis para que el OR no
   * se "escape" y se combine mal con otros filtros: sin parentesis,
   *   WHERE estado = ? OR nombre LIKE ?
   * devolveria TODOS los registros (activo o no) si el nombre coincide.
   *
   * @param {string[]} columnas  Nombres de columnas validados (literal de codigo).
   * @param {string|null} texto  Texto que busca el usuario.
   * @returns {Filtros} this
   */
  agregarBusquedaMulti(columnas, texto) {
    const termino = typeof texto === 'string' ? texto.trim() : '';

    if (termino === '') {
      return this;
    }

    // Se descarta cualquier columna que no parezca identificador SQL.
    // Se admite el alias opcional ("u.email") porque los listados con
    // JOIN lo usan para desambiguar columnas con el mismo nombre.
    const validas = columnas.filter((columna) =>
      /^([a-zA-Z_][a-zA-Z0-9_]*\.)?[a-zA-Z_][a-zA-Z0-9_]*$/.test(columna)
    );

    if (validas.length === 0) {
      throw new Error(`Columnas de busqueda no validas: ${columnas.join(', ')}`);
    }

    const clausula = `(${validas.map((columna) => `${columna} LIKE ?`).join(' OR ')})`;
    const patron = `%${this.#escapar(termino)}%`;

    this.#clausulas.push(clausula);
    this.#parametros.push(...validas.map(() => patron));

    return this;
  }

  /**
   * Escapa los caracteres especiales de LIKE: % _ y la barra invertida.
   * Se usa con la clausula ESCAPE de MySQL en quien llama, o con el
   * caracter de escape por defecto (barra invertida).
   *
   * @param {string} texto
   * @returns {string}
   */
  #escapar(texto) {
    // $& en el reemplazo inserta lo que coincidio (el caracter especial).
    return texto.replace(/[\\%_]/g, '\\$&');
  }

  // --------------------------- Salida ------------------------------

  /**
   * Devuelve la clausula WHERE completa, o '' si no hay filtros.
   *
   * @returns {string}
   */
  obtenerWhere() {
    if (this.#clausulas.length === 0) {
      return '';
    }

    // Todas las condiciones se unen con AND: el listado siempre es
    // "estado activo Y nombre contiene...".
    return `WHERE ${this.#clausulas.join(' AND ')}`;
  }

  /**
   * Devuelve COPIA de los parametros, en el mismo orden que las
   * clausulas (es decir, el orden exacto de los ? del SQL).
   *
   * @returns {Array}
   */
  obtenerParametros() {
    return [...this.#parametros];
  }
}

/**
 * Convierte la pagina pedida en los valores LIMIT / OFFSET.
 *
 *   pagina 1, limite 20  ->  LIMIT 20 OFFSET 0
 *   pagina 3, limite 20  ->  LIMIT 20 OFFSET 40
 *
 * La defensa contra paginas absurdas (0, negativas o gigantes) vive en
 * middleware/validarParametros.js; aqui solo se calcula.
 *
 * @param {number} pagina   1 en adelante.
 * @param {number} limite   Cuantos registros por pagina.
 * @returns {{ limite: number, offset: number }}
 */
function aLimites(pagina, limite) {
  const paginaSegura = Math.max(1, Number(pagina) || 1);
  const limiteSeguro = Math.max(1, Number(limite) || 20);

  return {
    limite: limiteSeguro,
    offset: (paginaSegura - 1) * limiteSeguro
  };
}

module.exports = {
  Filtros,
  aLimites
};
