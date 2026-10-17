/**
 * src/models/FichaServicio.js
 * ---------------------------------------------------------------------
 * ENTIDAD FichaServicio -> tabla `ficha_servicio` (N:N entre
 * `ficha_tecnica` y `servicios`, con atributo propio
 * `cantidad_requerida` — RN-07).
 *
 * Sin id propio: su llave es la pareja (idFichaTecnica, idServicio).
 */

class FichaServicio {
  #idFichaTecnica;
  #idServicio;
  #cantidadRequerida;
  #nombreServicio;

  constructor(idFichaTecnica = null, idServicio = null, cantidadRequerida = 1) {
    this.#idFichaTecnica = idFichaTecnica;
    this.#idServicio = idServicio;
    this.#cantidadRequerida = cantidadRequerida;
    this.#nombreServicio = null;
  }

  get idFichaTecnica() {
    return this.#idFichaTecnica;
  }

  set idFichaTecnica(valor) {
    this.#idFichaTecnica = valor;
  }

  get idServicio() {
    return this.#idServicio;
  }

  get cantidadRequerida() {
    return this.#cantidadRequerida;
  }

  set cantidadRequerida(valor) {
    this.#cantidadRequerida = valor;
  }

  get nombreServicio() {
    return this.#nombreServicio;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    const detalle = new FichaServicio(
      fila.id_ficha_tecnica,
      fila.id_servicio,
      fila.cantidad_requerida
    );

    if (fila.nombre_servicio !== undefined) {
      detalle.#nombreServicio = fila.nombre_servicio;
    }

    return detalle;
  }

  /** Linea cruda del body: solo idServicio y cantidadRequerida. */
  static desdeJSON(datos = {}) {
    return new FichaServicio(
      null,
      datos.idServicio ?? datos.id_servicio ?? null,
      datos.cantidadRequerida ?? datos.cantidad_requerida ?? 1
    );
  }

  /** Fila para INSERT/UPDATE (no existe columna generada aqui). */
  aFila() {
    return {
      id_ficha_tecnica: this.#idFichaTecnica,
      id_servicio: this.#idServicio,
      cantidad_requerida: this.#cantidadRequerida
    };
  }

  toJSON() {
    return {
      idFichaTecnica: this.#idFichaTecnica,
      idServicio: this.#idServicio,
      nombreServicio: this.#nombreServicio,
      cantidadRequerida: this.#cantidadRequerida
    };
  }
}

module.exports = FichaServicio;
