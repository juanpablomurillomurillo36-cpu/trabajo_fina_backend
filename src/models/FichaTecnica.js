/**
 * src/models/FichaTecnica.js
 * ---------------------------------------------------------------------
 * ENTIDAD FichaTecnica -> tabla `ficha_tecnica` (COMPOSICION 1:1 con
 * `evento`: uq_ficha_evento garantiza que un evento tenga COMO MAXIMO
 * UNA ficha — RN-07).
 *
 * `#servicios` trae el N:N (`ficha_servicio`) que inyecta el
 * repository al leer la ficha completa.
 */

class FichaTecnica {
  #idFichaTecnica;
  #idEvento;
  #tematica;
  #franjaHoraria;
  #cantidadInvitados;
  #observaciones;
  #servicios;

  constructor(
    id = null,
    idEvento = null,
    tematica = null,
    franjaHoraria = null,
    cantidadInvitados = 0,
    observaciones = null
  ) {
    this.#idFichaTecnica = id;
    this.#idEvento = idEvento;
    this.#tematica = tematica;
    this.#franjaHoraria = franjaHoraria;
    this.#cantidadInvitados = cantidadInvitados;
    this.#observaciones = observaciones;
    this.#servicios = null;
  }

  get id() {
    return this.#idFichaTecnica;
  }

  get idEvento() {
    return this.#idEvento;
  }

  get tematica() {
    return this.#tematica;
  }

  set tematica(valor) {
    this.#tematica = valor;
  }

  get franjaHoraria() {
    return this.#franjaHoraria;
  }

  set franjaHoraria(valor) {
    this.#franjaHoraria = valor;
  }

  get cantidadInvitados() {
    return this.#cantidadInvitados;
  }

  set cantidadInvitados(valor) {
    this.#cantidadInvitados = valor;
  }

  get observaciones() {
    return this.#observaciones;
  }

  set observaciones(valor) {
    this.#observaciones = valor;
  }

  get servicios() {
    return this.#servicios ?? [];
  }

  set servicios(lista) {
    this.#servicios = lista;
  }

  static desdeFila(fila) {
    if (!fila) return null;

    return new FichaTecnica(
      fila.id_ficha_tecnica,
      fila.id_evento,
      fila.tematica,
      fila.franja_horaria,
      fila.cantidad_invitados,
      fila.observaciones
    );
  }

  aFilaBaseDatos() {
    return {
      id_evento: this.#idEvento,
      tematica: this.#tematica,
      franja_horaria: this.#franjaHoraria,
      cantidad_invitados: this.#cantidadInvitados,
      observaciones: this.#observaciones
    };
  }

  toJSON() {
    const json = {
      id: this.#idFichaTecnica,
      idEvento: this.#idEvento,
      tematica: this.#tematica,
      franjaHoraria: this.#franjaHoraria,
      cantidadInvitados: this.#cantidadInvitados,
      observaciones: this.#observaciones
    };

    if (this.#servicios !== null) {
      json.servicios = this.#servicios.map((s) => s.toJSON());
    }

    return json;
  }
}

module.exports = FichaTecnica;
