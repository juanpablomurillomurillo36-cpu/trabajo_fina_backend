/**
 * src/middleware/validarParametros.js
 * ---------------------------------------------------------------------
 * Middlewares que validan los PARAMETROS de la peticion ANTES de que
 * llegue al controlador.
 *
 * POR QUE VALIDAR AQUI Y NO EN EL SERVICE?
 *
 *   req.params y req.query SIEMPRE llegan como TEXTO, incluso cuando
 *   la ruta dice /:id. Es decir, en `GET /api/roles/abc` el `id` vale
 *   la cadena "abc", no un numero.
 *
 *   Si validamos en el middleware:
 *      - el service recibe SIEMPRE tipos correctos (numeros, listos);
 *      - el controlador no tiene que repetir la comprobacion;
 *      - un error de formato se responde antes de tocar la base.
 *
 * DIFERENCIA CON validadores.js
 *   Aqui  -> parametros de URL y query (llegan de la ruta).
 *   Alli  -> cuerpo JSON y reglas de negocio (llegan de req.body).
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');

/**
 * Crea un middleware que valida uno o varios parametros numericos de
 * la ruta.
 *
 *   router.get('/:id', validarIdNumerico('id'), controlador.obtener);
 *
 * El resultado GUARDADO en req.idsValidados.id ya es un NUMERO, asi
 * que el controlador no tiene que convertir nada:
 *
 *   const id = req.idsValidados.id;   // ya es 7, no "7"
 *
 * @param {...string} nombres  Nombres de los parametros a validar
 * @returns {function} Middleware de Express
 */
function validarIdNumerico(...nombres) {
  return function (req, res, next) {
    const validados = {};

    for (const nombre of nombres) {
      const valor = req.params[nombre];
      const numero = formato.aEnteroONulo(valor);

      // Si no era numero positivo, no tiene sentido seguir.
      if (numero === null || numero <= 0) {
        return next(
          AppError.validacion(MENSAJES.VALIDACION.PARAMETRO_INVALIDO(nombre), [
            { campo: nombre, mensaje: MENSAJES.VALIDACION.ID_INVALIDO(nombre) }
          ])
        );
      }

      validados[nombre] = numero;
    }

    // Adjuntamos los valores ya convertidos en un objeto aparte.
    req.idsValidados = validados;

    return next();
  };
}

/**
 * Middleware que rechaza peticiones sin cuerpo JSON.
 *
 *   router.post('/', exigirCuerpo, controlador.crear);
 *
 * Sin esto, `POST /api/roles` con el cuerpo vacio pasaria al service
 * y el error que saldria seria confuso ("el campo nombre es
 * obligatorio" cuando no vino NADA). Aqui el mensaje es claro desde
 * el principio.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function exigirCuerpo(req, res, next) {
  const cuerpo = req.body;

  const estaVacio =
    cuerpo === undefined ||
    cuerpo === null ||
    (typeof cuerpo === 'object' && Object.keys(cuerpo).length === 0);

  if (estaVacio) {
    return next(AppError.validacion(MENSAJES.VALIDACION.CORPUS_VACIO));
  }

  return next();
}

/**
 * Middleware que normaliza los parametros de PAGINACION de la query.
 *
 *   GET /api/roles?pagina=3&limite=50  ->  req.paginacion = { pagina: 3, limite: 50 }
 *
 * Valores por defecto y tope de seguridad:
 *   - pagina minima 1 (no existen paginas 0 o negativas);
 *   - limite tope LIMITES.LIMITE_MAXIMO, para que nadie pueda tumbar
 *     la API pidiendo un millon de filas de golpe.
 *
 * Si el cliente manda texto raro ("pagina=abc"), se usa el valor por
 * defecto en vez de responder un error: la paginacion es una ayuda,
 * no un dato critico.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function validarPaginacion(req, res, next) {
  const { LIMITES } = require('../utils/constants');

  const pagina = formato.aEnteroONulo(req.query.pagina);
  const limite = formato.aEnteroONulo(req.query.limite);

  req.paginacion = {
    pagina: Math.max(1, pagina ?? LIMITES.PAGINA_DEFECTO),
    limite: Math.min(Math.max(1, limite ?? LIMITES.LIMITE_DEFECTO), LIMITES.LIMITE_MAXIMO)
  };

  return next();
}

module.exports = {
  validarIdNumerico,
  exigirCuerpo,
  validarPaginacion
};
