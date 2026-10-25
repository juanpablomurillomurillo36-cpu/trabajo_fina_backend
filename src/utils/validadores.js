/**
 * src/utils/validadores.js
 * ---------------------------------------------------------------------
 * Colector de errores de validacion.
 *
 * EL PROBLEMA QUE RESUELVE
 * Si cada validacion hiciera `throw` inmediato, al cliente le llegaria
 * UN solo error cada vez y tendria que volver a enviar la peticion
 * cinco veces para enterarse de los cinco campos mal.
 *
 * La solucion: recolectar TODOS los errores y lanzar UNA sola vez al
 * final, con el detalle de cada campo.
 *
 * USO TIPICO (dentro de un service)
 *
 *   const errores = new ColectorErrores();
 *
 *   errores.exigirTexto('nombre', datos.nombre, { maximo: 60 });
 *   errores.exigirCorreo('email', datos.email);
 *   errores.exigirValorDeLista('estado', datos.estado, ['activo', 'inactivo']);
 *
 *   errores.lanzarSiHayErrores();   // lanza 400 con el listado completo
 *
 * Si nada fallo, el flujo sigue normalmente.
 */

const AppError = require('./AppError');
const { LIMITES } = require('./constants');
const { limpiarTexto } = require('./formato');

class ColectorErrores {
  // Cada error es { campo, mensaje }; se guardan en orden de llegada
  // para que la respuesta salga en el mismo orden en que se valido.
  #errores;

  constructor() {
    this.#errores = [];
  }

  // ------------------------- Consultas -----------------------------

  /** true si al menos un campo fallo. */
  get tieneErrores() {
    return this.#errores.length > 0;
  }

  /** Copia del arreglo de errores (nunca la referencia original). */
  get errores() {
    return [...this.#errores];
  }

  /**
   * Cantidad de errores acumulados.
   * @returns {number}
   */
  contar() {
    return this.#errores.length;
  }

  // -------------------------- Registro -----------------------------

  /**
   * Agrega un error manualmente.
   * @param {string} campo
   * @param {string} mensaje
   */
  agregar(campo, mensaje) {
    this.#errores.push({ campo, mensaje });
    return this;
  }

  /**
   * Exige un texto no vacio y dentro del largo maximo.
   *
   * @param {string} campo      Nombre del campo (para el mensaje).
   * @param {*} valor           Lo que llego del cliente.
   * @param {object} opciones
   * @param {number}  opciones.maximo   Largo maximo permitido.
   * @param {boolean} opciones.requerido  false = vacio esta bien.
   * @param {boolean} opciones.permitirCero  true = "0" es un valor valido.
   * @returns {ColectorErrores} this, para encadenar.
   */
  exigirTexto(campo, valor, { maximo = LIMITES.DESCRIPCION, requerido = true } = {}) {
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      if (requerido) this.agregar(campo, `El campo "${campo}" es obligatorio`);
      return this;
    }

    if (typeof valor !== 'string') {
      this.agregar(campo, `El campo "${campo}" debe ser texto`);
      return this;
    }

    const texto = limpiarTexto(valor);

    if (texto === '') {
      if (requerido) this.agregar(campo, `El campo "${campo}" es obligatorio`);
      return this;
    }

    if (texto.length > maximo) {
      this.agregar(campo, `El campo "${campo}" no puede superar los ${maximo} caracteres`);
    }

    return this;
  }

  /**
   * Exige un correo con formato valido y dentro del largo de la
   * columna (CORREO).
   *
   * La expresion regular es deliberadamente simple: valida que haya
   * algo, una "@", algo, un punto y un dominio. No intenta adivinar
   * si el correo existe; eso solo lo puede decir un envio real.
   *
   * @param {string} campo
   * @param {*} valor
   * @param {boolean} requerido
   * @returns {ColectorErrores}
   */
  exigirCorreo(campo, valor, requerido = true) {
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      if (requerido) this.agregar(campo, `El campo "${campo}" es obligatorio`);
      return this;
    }

    if (typeof valor !== 'string') {
      this.agregar(campo, `El campo "${campo}" debe ser texto`);
      return this;
    }

    const correo = valor.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
      this.agregar(campo, `El campo "${campo}" no tiene un formato de correo valido`);
      return this;
    }

    if (correo.length > LIMITES.CORREO) {
      this.agregar(campo, `El campo "${campo}" no puede superar los ${LIMITES.CORREO} caracteres`);
    }

    return this;
  }

  /**
   * Exige una contrasena que cumpla la regla R-CLAVE-01:
   * al menos 8 caracteres, una letra y un numero.
   *
   * Se exige LETRA y NUMERO en lugar de exigir simbolos raros: los
   * estudios de usabilidad muestran que la gente recuerda mucho mejor
   * "Clave1234" que "Cl@v3!".
   *
   * @param {string} campo
   * @param {*} valor
   * @param {boolean} requerido
   * @returns {ColectorErrores}
   */
  exigirContrasena(campo, valor, requerido = true) {
    if (valor === undefined || valor === null || valor === '') {
      if (requerido) this.agregar(campo, `El campo "${campo}" es obligatorio`);
      return this;
    }

    if (typeof valor !== 'string') {
      this.agregar(campo, `El campo "${campo}" debe ser texto`);
      return this;
    }

    const clave = valor;

    if (clave.length < LIMITES.CONTRASENA_MIN) {
      this.agregar(campo, `La contrasena debe tener al menos ${LIMITES.CONTRASENA_MIN} caracteres`);
      return this;
    }

    if (clave.length > LIMITES.CONTRASENA_MAX) {
      this.agregar(campo, `La contrasena no puede superar los ${LIMITES.CONTRASENA_MAX} caracteres`);
      return this;
    }

    const tieneLetra = /[a-zA-Z]/.test(clave);
    const tieneNumero = /\d/.test(clave);

    if (!tieneLetra || !tieneNumero) {
      this.agregar(campo, 'La contrasena debe incluir al menos una letra y un numero');
    }

    return this;
  }

  /**
   * Exige un numero entero dentro de un rango.
   *
   * Acepta el valor ya convertido o el texto crudo ("7"): lo importante
   * es que lo que quede dentro de `datos` sea un NUMBER, porque MySQL
   * espera un entero y no un texto.
   *
   * @param {string} campo
   * @param {*} valor
   * @param {object} opciones
   * @param {boolean} opciones.requerido
   * @param {number}  opciones.minimo
   * @param {number}  opciones.maximo
   * @param {boolean} opciones.permitirCero
   * @returns {ColectorErrores}
   */
  exigirEntero(campo, valor, { requerido = true, minimo = null, maximo = null, permitirCero = false } = {}) {
    if (valor === undefined || valor === null || valor === '') {
      if (requerido) this.agregar(campo, `El campo "${campo}" es obligatorio`);
      return this;
    }

    const numero = typeof valor === 'number' ? valor : Number(valor);

    // Number.isInteger descarta 3.5, "abc" y Infinity de una vez.
    if (!Number.isInteger(numero)) {
      this.agregar(campo, `El campo "${campo}" debe ser un numero entero`);
      return this;
    }

    if (!permitirCero && numero === 0) {
      this.agregar(campo, `El campo "${campo}" debe ser mayor que cero`);
      return this;
    }

    if (minimo !== null && numero < minimo) {
      this.agregar(campo, `El campo "${campo}" debe ser al menos ${minimo}`);
    }

    if (maximo !== null && numero > maximo) {
      this.agregar(campo, `El campo "${campo}" no puede superar ${maximo}`);
    }

    return this;
  }

  /**
   * Exige un identificador de ruta positivo.
   * Es un alias semantico de exigirEntero(minimo: 1) para que en las
   * rutas se lea mejor: `errores.exigirId('id', req.params.id)`.
   *
   * @param {string} campo
   * @param {*} valor
   * @returns {ColectorErrores}
   */
  exigirId(campo, valor) {
    return this.exigirEntero(campo, valor, { minimo: 1 });
  }

  /**
   * Exige una fecha interpretable.
   *
   * @param {string} campo
   * @param {*} valor
   * @param {boolean} requerido
   * @param {boolean} futura  true = debe ser posterior a hoy.
   * @param {boolean} pasada  true = debe ser anterior a hoy.
   * @returns {ColectorErrores}
   */
  exigirFecha(campo, valor, { requerido = true, futura = false, pasada = false } = {}) {
    if (valor === undefined || valor === null || valor === '') {
      if (requerido) this.agregar(campo, `El campo "${campo}" es obligatorio`);
      return this;
    }

    // new Date('basura') produce Invalid Date y getTime() da NaN.
    const fecha = valor instanceof Date ? valor : new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
      this.agregar(campo, `El campo "${campo}" no es una fecha valida`);
      return this;
    }

    const ahora = Date.now();

    if (futura && fecha.getTime() <= ahora) {
      this.agregar(campo, `El campo "${campo}" debe ser una fecha futura`);
    }

    if (pasada && fecha.getTime() >= ahora) {
      this.agregar(campo, `El campo "${campo}" debe ser una fecha pasada`);
    }

    return this;
  }

  /**
   * Exige que el valor pertenezca a una lista cerrada de valores.
   * Es el validador natural de las columnas ENUM de MySQL.
   *
   * @param {string} campo
   * @param {*} valor
   * @param {string[]} permitidos
   * @param {boolean} requerido
   * @returns {ColectorErrores}
   */
  exigirValorDeLista(campo, valor, permitidos, requerido = true) {
    if (valor === undefined || valor === null || valor === '') {
      if (requerido) this.agregar(campo, `El campo "${campo}" es obligatorio`);
      return this;
    }

    if (!permitidos.includes(valor)) {
      this.agregar(campo, `El campo "${campo}" solo acepta: ${permitidos.join(', ')}`);
    }

    return this;
  }

  /**
   * Valida un ID de ruta ya convertido. Si es invalido, se guarda el
   * error aqui; quien lo llama decide si lanza de inmediato o sigue.
   *
   * @param {string} campo
   * @param {*} valor
   * @returns {ColectorErrores}
   */
  exigirIdNumerico(campo, valor) {
    return this.exigirId(campo, valor);
  }

  // ------------------------- Lanzamiento ---------------------------

  /**
   * Devuelve los errores como lista de { campo, mensaje }.
   * @returns {Array}
   */
  aLista() {
    return this.errores;
  }

  /**
   * Si hay al menos un error, lanza AppError.validacion (400) con
   * TODOS los detalles.
   *
   * Este es el metodo que cierra el ciclo: una sola llamada al final
   * del service.
   *
   * @throws {AppError}
   */
  lanzarSiHayErrores() {
    if (!this.tieneErrores) return;

    throw AppError.validacion('La peticion contiene datos invalidos', this.errores);
  }
}

module.exports = { ColectorErrores };
