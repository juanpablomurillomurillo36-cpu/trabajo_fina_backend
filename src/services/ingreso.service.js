/**
 * src/services/ingreso.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `ingresos` (RN-05 / control de aforo):
 *
 *  - validar QR (fase 36): el codigo escaneado debe pertenecer a una
 *    reserva CONFIRMADA y VIGENTE; un codigo desconocido -> 400.
 *  - UNICIDAD: un QR ya usado no vuelve a entrar -> 409
 *    RESERVA_YA_INGRESADA (version amigable de uq_ingresos_codigo_qr;
 *    es la "vigencia unica" que pide el plan).
 *  - el registro guarda quien valido (usuario con sesion), cuando y por
 *    que puerta: es la evidencia del control de acceso.
 *
 * Reglas de la fase 37 (SAF / RN-06):
 *  - aforo ocupado = ingresos validos de HOY (la tabla no registra
 *    salidas; supuesto documentado en ssr.md).
 *  - al 100 % se BLOQUEA el siguiente ingreso -> 409 AFORO_SUPERADO.
 *  - al 90 % o mas se registra un aviso en el log (alerta SAF, C8).
 *  - GET /aforo expone ocupado/maximo/porcentaje/estado.
 *  Sin try/catch (R-ASYNC).
 */

const ingresoRepository = require('../repositories/IngresoRepository');
const reservaRepository = require('../repositories/ReservaRepository');
const configuracion = require('../config/env');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const fechas = require('../utils/fechas');
const { registrarAviso } = require('../middleware/logger');
const { ColectorErrores } = require('../utils/validadores');
const {
  ESTADO_INGRESO,
  ESTADO_RESERVA,
  LIMITES,
  AFORO
} = require('../utils/constants');

const ESTADOS_PERMITIDOS = Object.values(ESTADO_INGRESO);
// Columnas de la tabla: puerta_acceso VARCHAR(30), tipo_dispositivo VARCHAR(50).
const MAXIMO_PUERTA = 30;
const MAXIMO_DISPOSITIVO = 50;

class IngresoService {
  /** ?estado=&fecha=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const fechaIso = fechas.aFechaISO(filtros.fecha);
    const fecha = fechaIso === null ? null : fechaIso.slice(0, 10);
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await ingresoRepository.listar({ estado, fecha, busqueda, pagina, limite });
    return { ingresos: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const ingreso = await ingresoRepository.obtenerPorId(id);
    if (ingreso === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('ingreso'));
    }
    return ingreso.toJSON();
  }

  /**
   * Estado actual del SAF (aforo): ocupacion de hoy contra el tope de
   * `configuracion.negocio.aforoMaximo`.
   *
   * @returns {Promise<{ocupado:number, maximo:number, porcentaje:number, estado:string}>}
   */
  async aforo() {
    const ocupado = await ingresoRepository.contarOcupados();
    const maximo = configuracion.negocio.aforoMaximo;
    const porcentaje = maximo > 0 ? Math.round((ocupado / maximo) * 100) : 0;

    let estado = 'normal';
    if (porcentaje >= AFORO.PORCENTAJE_BLOQUEO) estado = 'lleno';
    else if (porcentaje >= AFORO.PORCENTAJE_ALERTA) estado = 'alerta';

    return { ocupado, maximo, porcentaje, estado };
  }

  /**
   * Validar QR y registrar el ingreso (fase 36).
   *
   * @param {object} cuerpo   { codigoQr, puertaAcceso, tipoDispositivo? }
   * @param {number} idUsuario  Quien valida (sesion JWT).
   * @returns {Promise<object>} el ingreso creado.
   */
  async validar(cuerpo, idUsuario) {
    // --- 400: datos del escaneo ---------------------------------------
    const colector = new ColectorErrores();
    colector.exigirTexto('codigoQr', cuerpo?.codigoQr, { requerido: true, maximo: 100 });
    colector.exigirTexto('puertaAcceso', cuerpo?.puertaAcceso, { requerido: true, maximo: MAXIMO_PUERTA });
    colector.exigirTexto('tipoDispositivo', cuerpo?.tipoDispositivo, {
      requerido: false,
      maximo: MAXIMO_DISPOSITIVO
    });
    colector.lanzarSiHay();

    const codigo = formato.limpiarTexto(cuerpo.codigoQr);

    // --- 400: ¿el QR es de alguna reserva? -----------------------------
    const reserva = await reservaRepository.obtenerPorCodigoQr(codigo);
    if (reserva === null) {
      throw AppError.validacion(MENSAJES.NEGOCIO.QR_INVALIDO, [
        { campo: 'codigoQr', mensaje: MENSAJES.NEGOCIO.QR_INVALIDO }
      ]);
    }

    // --- 409: ¿la reserva sigue vigente? -------------------------------
    if (reserva.estado !== ESTADO_RESERVA.CONFIRMADA) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.QR_RESERVA_NO_VIGENTE, [
        { campo: 'codigoQr', mensaje: MENSAJES.NEGOCIO.QR_RESERVA_NO_VIGENTE }
      ]);
    }

    // --- 409: ¿ya entro con este QR? (vigencia unica) ------------------
    if (await ingresoRepository.existePorCodigoQr(codigo)) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.RESERVA_YA_INGRESADA, [
        { campo: 'codigoQr', mensaje: MENSAJES.NEGOCIO.RESERVA_YA_INGRESADA }
      ]);
    }

    // --- SAF: bloqueo al 100 % de aforo (fase 37) ----------------------
    const aforoActual = await this.aforo();
    if (aforoActual.estado === 'lleno') {
      throw AppError.conflicto(MENSAJES.NEGOCIO.AFORO_SUPERADO(aforoActual.maximo), [
        { campo: 'codigoQr', mensaje: MENSAJES.NEGOCIO.AFORO_SUPERADO(aforoActual.maximo) }
      ]);
    }

    // --- alta ------------------------------------------------------------
    const ahora = fechas.ahoraEnMySQL(); // "YYYY-MM-DD HH:MM:SS"
    const [fecha, hora] = ahora.split(' ');

    const id = await ingresoRepository.crear({
      id_cliente: reserva.idCliente,
      id_reserva: reserva.id,
      codigo_qr: codigo,
      fecha,
      hora,
      puerta_acceso: formato.limpiarTexto(cuerpo.puertaAcceso),
      tipo_dispositivo: formato.limpiarTexto(cuerpo.tipoDispositivo) || null,
      validado_por: idUsuario,
      estado: ESTADO_INGRESO.VALIDO
    });

    // --- SAF: alerta al 90 % o mas (aviso en el log, C8) ---------------
    const ocupadoTrasEntrar = aforoActual.ocupado + 1;
    const porcentaje = Math.round((ocupadoTrasEntrar / aforoActual.maximo) * 100);
    if (porcentaje >= AFORO.PORCENTAJE_ALERTA) {
      registrarAviso('AFORO_EN_ALERTA', {
        ocupado: ocupadoTrasEntrar,
        maximo: aforoActual.maximo,
        porcentaje
      });
    }

    return this.obtenerPorId(id);
  }
}

// Singleton.
module.exports = new IngresoService();
