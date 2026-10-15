/**
 * src/utils/validadores.js
 * ---------------------------------------------------------------------
 * Validadores atomicos + la clase ColectorErrores.
 *
 * FILOSOFIA DE VALIDACION DE ESTA API
 * ---------------------------------------------------------------------
 *   NO cortamos en el primer error. Revisamos TODOS los campos y
 *   devolvemos la lista COMPLETA de problemas en una sola respuesta.
 *   Asi el usuario corrige el formulario una vez y no de a un campo
 *   (mejor experiencia y menos idas y vueltas al servidor).
 *
 *   Para lograrlo usamos la clase ColectorErrores, que va acumulando
 *   los errores encontrados y al final decide si lanzar la excepcion.
 *
 * CAPAS DE VALIDACION (para no confundirlas)
 *   1. Middlewares de la ruta  -> validan PARAMETROS de la URL y la query
 *      (por ejemplo que :id sea un numero). Estan en middleware/.
 *   2. Los services            -> validan el CUERPO y las REGLAS de
 *      negocio. Estan en este archivo, usando ColectorErrores.
 */

const MENSAJES = require('./mensajes');
const { LIMITES } = require('./constants');

// ---------------------------------------------------------------------
// Expresiones regulares reutilizables
// ---------------------------------------------------------------------

// Letras del espanol (incluye tildes y enie), espacios, apostrofe y guion.
const PATRON_NOMBRE = /^[A-Za-zÀ-ɏḀ-ỿ\s'.-]+$/;

// Forma basica de correo: algo@algo.algo
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// RFC mexicano fisico: 4 letras + 6 digitos + homoclave (3 alfanumericos)
const PATRON_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

// NSS: 11 digitos (seguro social)
const PATRON_NSS = /^\d{11}$/;

// ---------------------------------------------------------------------
// Validadores atomicos: cada funcion responde true o false
// ---------------------------------------------------------------------

/** El valor es un texto con al menos un caracter visible. */
function esTextoNoVacio(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/** El texto NO supera el maximo de caracteres. */
function cumpleLongitud(valor, maximo = LIMITES.VARCHAR_CORTO) {
  return typeof valor === 'string' && valor.length <= maximo;
}

/** El texto solo contiene letras, espacios, apostrofes, puntos y guiones. */
function esSoloLetras(valor) {
  return typeof valor === 'string' && PATRON_NOMBRE.test(valor);
}

/** El valor es un numero entero. */
function esEntero(valor) {
  return Number.isInteger(Number(valor)) && String(valor).trim() !== '';
}

/** El valor es un numero entero mayor que cero. Se usa para los id. */
function esEnteroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
}

/** El numero esta dentro del rango inclusivo [minimo, maximo]. */
function estaEnRango(valor, minimo, maximo) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= minimo && numero <= maximo;
}

/** El valor pertenece a una lista cerrada de opciones (los ENUM). */
function estaEnLista(valor, listaPermitida) {
  return listaPermitida.includes(valor);
}

/** El texto tiene forma de correo electronico. */
function esCorreoValido(valor) {
  return typeof valor === 'string' && PATRON_CORREO.test(valor.trim().toLowerCase());
}

/** El texto tiene forma de RFC mexicano (se convierte a mayusculas antes). */
function esRfcValido(valor) {
  return typeof valor === 'string' && PATRON_RFC.test(valor.trim().toUpperCase());
}

/** El texto son exactamente 11 digitos (NSS). */
function esNssValido(valor) {
  return typeof valor === 'string' && PATRON_NSS.test(valor.trim());
}

/**
 * La contraseña cumple la regla de fortaleza:
 *   minimo 8 caracteres + al menos una letra + al menos un numero.
 *
 * Esta misma regla se usa en el registro Y en el restablecimiento,
 * por eso vive aqui una sola vez (R-DRY).
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esContrasenaFuerte(valor) {
  if (typeof valor !== 'string') return false;

  const tieneLongitud = valor.length >= 8;
  const tieneLetra = /[a-zA-ZÀ-ÿ]/.test(valor);
  const tieneNumero = /\d/.test(valor);

  return tieneLongitud && tieneLetra && tieneNumero;
}

// ---------------------------------------------------------------------
// Clase ColectorErrores
// ---------------------------------------------------------------------

/**
 * Acumula errores de validacion en forma de { campo, mensaje }.
 *
 * Uso tipico dentro de un service:
 *
 *   const errores = new ColectorErrores();
 *   errores.exigirTexto('nombre', datos.nombre, { soloLetras: true });
 *   errores.exigirCorreo('email', datos.email);
 *   errores.lanzarSiHay('Los datos del usuario no son validos.');
 *
 * Fijate en el patron: encadenamos comprobaciones y al final UNA linea
 * decide si lanzar la excepcion o continuar.
 */
class ColectorErrores {
  // Atributo privado: nadie puede manipular la lista desde afuera.
  #errores;

  constructor() {
    this.#errores = [];
  }

  // -------- Getters --------

  /** Copia de la lista de errores (para no exponer el arreglo interno). */
  get errores() {
    return [...this.#errores];
  }

  /** Cantidad de errores acumulados. */
  get cantidad() {
    return this.#errores.length;
  }

  /** true si no se encontro ningun error. */
  get esValido() {
    return this.#errores.length === 0;
  }

  // -------- Metodos de registro --------

  /**
   * Agrega un error a la lista.
   * Devuelve `this` para poder encadenar llamadas (patron fluent).
   */
  agregar(campo, mensaje) {
    this.#errores.push({ campo, mensaje });
    return this;
  }

  /**
   * Agrega el error solo si la condicion es verdadera.
   * Es azucar sintactico para no escribir `if` en cada validacion.
   */
  agregarSi(condicion, campo, mensaje) {
    if (condicion) {
      this.agregar(campo, mensaje);
    }
    return this;
  }

  // -------- Validaciones de alto nivel --------
  // Cada metodo valida un tipo de dato completo y agrega todos los
  // errores que encuentre para ese campo.

  /**
   * Campo de texto. Valida presencia, longitud y (opcional) que sean
   * solo letras.
   *
   * @param {string}  campo        Nombre del campo, para el mensaje.
   * @param {*}       valor        Valor a validar.
   * @param {object}  opciones
   * @param {boolean} opciones.requerido   Si es obligatorio (defecto true).
   * @param {number}  opciones.maximo      Longitud maxima (defecto 45).
   * @param {boolean} opciones.soloLetras  Si debe ser solo letras (defecto false).
   */
  exigirTexto(campo, valor, opciones = {}) {
    const {
      requerido = true,
      maximo = LIMITES.VARCHAR_CORTO,
      soloLetras = false
    } = opciones;

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      // Si era opcional y no vino, no hay nada mas que validar.
      return this;
    }

    if (typeof valor !== 'string') {
      return this.agregar(campo, MENSAJES.VALIDACION.TEXTO(campo));
    }

    this.agregarSi(
      !esTextoNoVacio(valor),
      campo,
      MENSAJES.VALIDACION.REQUERIDO(campo)
    );

    this.agregarSi(
      !cumpleLongitud(valor, maximo),
      campo,
      MENSAJES.VALIDACION.LONGITUD_MAXIMA(campo, maximo)
    );

    if (soloLetras && esTextoNoVacio(valor)) {
      this.agregarSi(
        !esSoloLetras(valor),
        campo,
        MENSAJES.VALIDACION.SOLO_LETRAS(campo)
      );
    }

    return this;
  }

  /**
   * Campo de correo electronico. Obligatorio por defecto porque la
   * columna `email` de usuarios es UNIQUE y NOT NULL.
   */
  exigirCorreo(campo, valor, opciones = {}) {
    const { requerido = true, maximo = LIMITES.VARCHAR_LARGO } = opciones;

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      return this;
    }

    if (typeof valor !== 'string') {
      return this.agregar(campo, MENSAJES.VALIDACION.CORREO(campo));
    }

    this.agregarSi(
      !esCorreoValido(valor),
      campo,
      MENSAJES.VALIDACION.CORREO(campo)
    );

    this.agregarSi(
      !cumpleLongitud(valor, maximo),
      campo,
      MENSAJES.VALIDACION.LONGITUD_MAXIMA(campo, maximo)
    );

    return this;
  }

  /**
   * Campo de fecha en formato AAAA-MM-DD.
   *
   * Se requiere fechas.js dentro del metodo (y no arriba del archivo)
   * para evitar una dependencia circular entre los modulos de utils.
   */
  exigirFecha(campo, valor, opciones = {}) {
    const { requerido = true, permitirFutura = false, permitirPasada = true } = opciones;
    const fechas = require('./fechas');

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      return this;
    }

    const iso = fechas.aFechaISO(valor);

    if (iso === null) {
      return this.agregar(campo, MENSAJES.VALIDACION.FECHA_INVALIDA(campo));
    }

    if (!permitirFutura && fechas.esFutura(iso)) {
      this.agregar(campo, MENSAJES.VALIDACION.FECHA_FUTURA(campo));
    }

    if (!permitirPasada && fechas.esPasada(iso)) {
      this.agregar(campo, MENSAJES.VALIDACION.FECHA_PASADA(campo));
    }

    return this;
  }

  /**
   * Campo de fecha Y hora (para intervalos de reservas y agendas).
   * Por defecto NO permite fechas pasadas, porque no se agenda en el
   * retroceso.
   */
  exigirFechaHora(campo, valor, opciones = {}) {
    const { requerido = true, permitirPasada = false } = opciones;
    const fechas = require('./fechas');

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      return this;
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
      return this.agregar(campo, MENSAJES.VALIDACION.FORMATO_FECHA_HORA(campo));
    }

    if (!permitirPasada && fechas.esPasada(fecha)) {
      this.agregar(campo, MENSAJES.VALIDACION.FECHA_PASADA(campo));
    }

    return this;
  }

  /** Campo entero, con rango opcional. */
  exigirEntero(campo, valor, opciones = {}) {
    const { requerido = true, minimo = null, maximo = null } = opciones;

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      return this;
    }

    if (!esEntero(valor)) {
      return this.agregar(campo, MENSAJES.VALIDACION.ENTERO(campo));
    }

    if (minimo !== null && maximo !== null && !estaEnRango(valor, minimo, maximo)) {
      this.agregar(campo, MENSAJES.VALIDACION.RANGO(campo, minimo, maximo));
    }

    return this;
  }

  /** Campo numero decimal (precios, totales). */
  exigirDecimal(campo, valor, opciones = {}) {
    const { requerido = true, minimo = 0 } = opciones;

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      return this;
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return this.agregar(campo, MENSAJES.VALIDACION.ENTERO(campo));
    }

    if (numero < minimo) {
      this.agregar(campo, MENSAJES.VALIDACION.RANGO(campo, minimo, 'sin limite'));
    }

    return this;
  }

  /** Identificador: entero positivo obligatorio. */
  exigirId(campo, valor) {
    if (!esEnteroPositivo(valor)) {
      this.agregar(campo, MENSAJES.VALIDACION.ID_INVALIDO(campo));
    }
    return this;
  }

  /**
   * Campo que debe pertenecer a una lista cerrada.
   * Se usa para todas las columnas ENUM de la base de datos.
   */
  exigirValorDeLista(campo, valor, listaPermitida, opciones = {}) {
    const { requerido = true } = opciones;

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      return this;
    }

    this.agregarSi(
      !estaEnLista(valor, listaPermitida),
      campo,
      MENSAJES.VALIDACION.VALOR_PERMITIDO(campo, listaPermitida)
    );

    return this;
  }

  /**
   * Campo de contraseña con la regla de fortaleza.
   * Se usa en registro, creacion de usuario y restablecimiento.
   */
  exigirContrasena(campo, valor, opciones = {}) {
    const { requerido = true, maximo = 72 } = opciones;

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      return this;
    }

    if (typeof valor !== 'string') {
      return this.agregar(campo, MENSAJES.VALIDACION.TEXTO(campo));
    }

    this.agregarSi(
      !esContrasenaFuerte(valor),
      campo,
      MENSAJES.NEGOCIO.CONTRASENA_DEBIL
    );

    this.agregarSi(
      !cumpleLongitud(valor, maximo),
      campo,
      MENSAJES.VALIDACION.LONGITUD_MAXIMA(campo, maximo)
    );

    return this;
  }

  /** Campo RFC mexicano (se valida y se guarda en mayusculas). */
  exigirRfc(campo, valor, opciones = {}) {
    const { requerido = true } = opciones;

    const estaAusente = valor === null || valor === undefined || valor === '';

    if (estaAusente) {
      if (requerido) {
        this.agregar(campo, MENSAJES.VALIDACION.REQUERIDO(campo));
      }
      return this;
    }

    this.agregarSi(
      !esRfcValido(valor),
      campo,
      `El campo "${campo}" debe ser un RFC valido (ej. XAXX010101000)`
    );

    return this;
  }

  // -------- Cierre --------

  /**
   * Si hay errores acumulados, lanza un AppError de validacion con la
   * lista COMPLETA. Si no hay errores, no hace nada y la ejecucion
   * sigue.
   *
   * Se requiere AppError aqui dentro para evitar dependencia circular.
   */
  lanzarSiHay(mensaje = 'Los datos enviados no son validos.') {
    if (!this.esValido) {
      const AppError = require('./AppError');
      throw AppError.validacion(mensaje, this.errores);
    }
  }
}

module.exports = {
  PATRON_NOMBRE,
  PATRON_CORREO,
  PATRON_RFC,
  PATRON_NSS,
  esTextoNoVacio,
  cumpleLongitud,
  esSoloLetras,
  esEntero,
  esEnteroPositivo,
  estaEnRango,
  estaEnLista,
  esCorreoValido,
  esRfcValido,
  esNssValido,
  esContrasenaFuerte,
  ColectorErrores
};
