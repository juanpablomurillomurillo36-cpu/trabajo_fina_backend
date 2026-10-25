/**
 * src/middleware/validarParametros.js
 * ---------------------------------------------------------------------
 * Middlewares que validan la URL y el cuerpo ANTES de que la peticion
 * llegue al controlador.
 *
 * POR QUE VALIDAR AQUI Y NO EN EL CONTROLADOR?
 * Porque es una validacion de FORMATO, no de negocio. Si alguien pide
 *
 *     GET /api/roles/abc
 *
 * no tiene sentido abrir una conexion a MySQL: rechazamos de
 * inmediato con 400 y ahorramos trabajo al servidor.
 *
 * Esto se llama "fail fast": fallar lo antes posible, lo mas cerca
 * posible de donde entra el dato malo.
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');

/**
 * Comprueba que un texto sea un numero entero estrictamente positivo.
 *
 * "7"    -> true
 * "7.5"  -> false
 * " 7 "  -> true (se recorta antes)
 * "-1"   -> false
 * "abc"  -> false
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esEnteroPositivo(valor) {
  if (typeof valor === 'number') {
    return Number.isInteger(valor) && valor > 0;
  }

  if (typeof valor !== 'string') return false;

  const texto = valor.trim();
  if (texto === '') return false;

  // Se acepta solo un signo menos opcional y digitos: nada de "1e5",
  // nada de "0x10", nada de espacios intermedios.
  if (!/^-?\d+$/.test(texto)) return false;

  return Number.parseInt(texto, 10) > 0;
}

/**
 * FABRICA DE MIDDLEWARES.
 *
 * Esta funcion NO es el middleware: es una funcion que DEVUELVE un
 * middleware. Ese patron se llama "closure" y permite configurar el
 * middleware al registrarlo:
 *
 *   router.get('/:id', validarIdNumerico('id'), controlador.obtener);
 *   router.delete('/:id/permisos/:idPermiso',
 *     validarIdNumerico('id'),
 *     validarIdNumerico('idPermiso'),
 *     controlador.quitarPermiso);
 *
 * @param {string} nombreParametro  Nombre del parametro en la ruta.
 * @returns {function} Middleware de Express.
 */
function validarIdNumerico(nombreParametro = 'id') {
  return function (req, res, next) {
    // req.params contiene los parametros de la ruta (:id -> req.params.id)
    const valor = req.params[nombreParametro];

    if (!esEnteroPositivo(valor)) {
      const mensaje = `El parametro "${nombreParametro}" debe ser un numero entero positivo`;

      // Pasamos el error al middleware manejadorErrores. No respondemos
      // aqui: un middleware que responde rompe la cadena y complica
      // el registro centralizado de errores.
      return next(
        AppError.validacion(mensaje, [{ campo: nombreParametro, mensaje }])
      );
    }

    // Convertimos el texto "7" al numero 7 y lo dejamos disponible en
    // req.idsValidados, para que el controlador no repita la conversion
    // ni tenga que acordarse de usar parseInt.
    if (!req.idsValidados) {
      req.idsValidados = {};
    }
    req.idsValidados[nombreParametro] = Number.parseInt(valor, 10);

    next();
  };
}

/**
 * Rechaza las peticiones con el cuerpo vacio.
 *
 * Se usa en POST y PUT, donde enviar {} casi siempre es un error del
 * cliente: o olvido la cabecera Content-Type (y Express dejo req.body
 * vacio), o mando un objeto sin ningun campo.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {function} next
 */
function exigirCuerpo(req, res, next) {
  const cuerpo = req.body;

  const estaVacio =
    cuerpo === null ||
    cuerpo === undefined ||
    typeof cuerpo !== 'object' ||
    Array.isArray(cuerpo) ||
    Object.keys(cuerpo).length === 0;

  if (estaVacio) {
    return next(AppError.cuerpoInvalido(MENSAJES.VALIDACION.CUERPO_VACIO));
  }

  next();
}

module.exports = { validarIdNumerico, exigirCuerpo, esEnteroPositivo };
