/**
 * src/services/reserva.service.js
 * ---------------------------------------------------------------------
 * REGLAS DE NEGOCIO de `reservas` (RN-02 / RN-04) — COMPOSICION P4:
 * reserva y lineas entran juntas o no se hace nada (transaccion).
 *
 * Reglas de la fase 33 (CRUD):
 *  - cliente obligatorio, debe EXISTIR y estar ACTIVO -> 400.
 *  - tipoEspacio: 'vip' o 'mesa'; identificador y fecha/hora req -> 400.
 *  - detalles: al menos 1 servicio ACTIVO con cantidad >= 1 -> 400.
 *  - el precio de cada linea sale SIEMPRE del catalogo (no del body).
 *  - subtotal = suma de subtotales (calculado aqui, nunca del cliente).
 *  - descuento (RN-04): si el body lo trae, 0 <= descuento <= subtotal
 *    y solo aplica con >= 3 servicios -> 400; si NO viene, se calcula
 *    automatico 10% cuando hay 3 o mas servicios.
 *  - solo reservas PENDIENTES se editan o eliminan -> 409.
 *
 * Reglas de la fase 34:
 *  - CONFLICTO de horario/espacio: ya existe reserva para ese espacio
 *    en esa fecha y hora -> 409 CONFLICTO_HORARIO (version amigable del
 *    indice unico; revisada DESPUES del colector: 400 -> 409).
 *  - cambiar estado: confirmar solo desde pendiente (409); cancelar
 *    desde pendiente o confirmada (409 si ya estaba cancelada).
 *  Sin try/catch (R-ASYNC).
 */

const reservaRepository = require('../repositories/ReservaRepository');
const clienteRepository = require('../repositories/ClienteRepository');
const servicioRepository = require('../repositories/ServicioRepository');
const DetalleReserva = require('../models/DetalleReserva');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const fechas = require('../utils/fechas');
const { ColectorErrores } = require('../utils/validadores');
const { ESTADO_RESERVA, TIPO_ESPACIO, DESCUENTO, LIMITES } = require('../utils/constants');

const ESTADOS_PERMITIDOS = Object.values(ESTADO_RESERVA);
const TIPOS_PERMITIDOS = Object.values(TIPO_ESPACIO);
// La columna identificador_espacio es VARCHAR(30).
const MAXIMO_IDENTIFICADOR = 30;

/**
 * Valida la cabecera y TODAS las lineas de la reserva.
 *
 * Los servicios se resuelven en PARALELO (Promise.all) con ids
 * unicos: un body con 10 lineas no dispara 10 selects repetidos.
 *
 * @param {object} cuerpo
 * @param {string} [estadoInicial]
 * @param {number|null} [idActual]  Reserva en edicion (para excluir su
 *                                  propio id del chequeo de conflicto).
 * @returns {Promise<{datos:object, detalles:DetalleReserva[]}>}
 */
async function preparar(cuerpo, estadoInicial = ESTADO_RESERVA.PENDIENTE, idActual = null) {
  const colector = new ColectorErrores();

  // --- cliente ---------------------------------------------------------
  colector.exigirId('idCliente', cuerpo?.idCliente);
  const idCliente = formato.aEnteroONulo(cuerpo?.idCliente);
  let clienteOk = false;

  if (idCliente !== null) {
    const cliente = await clienteRepository.obtenerPorId(idCliente);
    if (cliente === null) {
      colector.agregar('idCliente', 'El cliente indicado no existe');
    } else if (!cliente.estaActivo()) {
      colector.agregar('idCliente', 'El cliente indicado esta inactivo');
    } else {
      clienteOk = true;
    }
  }

  // --- espacio ----------------------------------------------------------
  colector.exigirValorDeLista('tipoEspacio', cuerpo?.tipoEspacio, TIPOS_PERMITIDOS);
  colector.exigirTexto('identificadorEspacio', cuerpo?.identificadorEspacio, {
    requerido: true,
    maximo: MAXIMO_IDENTIFICADOR
  });

  // --- fecha y hora -----------------------------------------------------
  colector.exigirFecha('fecha', cuerpo?.fecha, {
    requerido: true,
    permitirFutura: true,
    permitirPasada: true
  });
  colector.exigirHora('hora', cuerpo?.hora, { requerido: true });

  const fechaIso = fechas.aFechaISO(cuerpo?.fecha);
  const datos = {
    id_cliente: clienteOk ? idCliente : null,
    tipo_espacio: TIPOS_PERMITIDOS.includes(cuerpo?.tipoEspacio) ? cuerpo.tipoEspacio : null,
    identificador_espacio: formato.limpiarTexto(cuerpo?.identificadorEspacio) || '',
    fecha: fechaIso === null ? null : fechaIso.slice(0, 10),
    hora: formato.aHoraONulo(cuerpo?.hora),
    estado: estadoInicial
  };

  // --- lineas -----------------------------------------------------------
  const crudos = Array.isArray(cuerpo?.detalles) ? cuerpo.detalles : [];

  if (crudos.length === 0) {
    colector.agregar('detalles', MENSAJES.NEGOCIO.RESERVA_SIN_DETALLES);
  }

  const idsServicios = [
    ...new Set(
      crudos
        .map((d) => formato.aEnteroONulo(d?.idServicio))
        .filter((id) => id !== null)
    )
  ];
  const consultas = await Promise.all(
    idsServicios.map((id) => servicioRepository.obtenerPorId(id))
  );
  const mapaServicios = new Map(idsServicios.map((id, i) => [id, consultas[i]]));

  const detalles = [];

  crudos.forEach((linea, i) => {
    const campo = `detalles[${i}]`;
    const idServicio = formato.aEnteroONulo(linea?.idServicio);
    const servicio = idServicio !== null ? mapaServicios.get(idServicio) : null;

    if (idServicio === null) {
      colector.agregar(`${campo}.idServicio`, 'Debe ser un id de servicio valido');
    } else if (servicio === null || !servicio.estaActivo()) {
      colector.agregar(`${campo}.idServicio`, 'El servicio indicado no existe o esta inactivo');
    }

    const cantidad = formato.aEnteroONulo(linea?.cantidad);
    if (cantidad === null || cantidad < 1 || cantidad > 999) {
      colector.agregar(`${campo}.cantidad`, 'Debe ser un entero entre 1 y 999');
    }

    // El precio NO viene del body: se toma del catalogo (fuente unica).
    if (servicio !== null && servicio.estaActivo() && cantidad !== null && cantidad >= 1 && cantidad <= 999) {
      detalles.push(
        new DetalleReserva(null, null, idServicio, cantidad, servicio.precio)
      );
    }
  });

  colector.lanzarSiHay();

  if (!clienteOk) {
    // No deberia llegar: exigirId/agregar ya lanzo. Defensa explicita.
    throw AppError.validacion('El cliente indicado no es valido');
  }

  // --- subtotal y descuento (RN-04), calculados por el server ----------
  const subtotal = detalles.reduce((suma, d) => suma + d.subtotal, 0);
  let descuento;

  const trajoDescuento = cuerpo?.descuento !== undefined && cuerpo?.descuento !== null && cuerpo?.descuento !== '';

  if (trajoDescuento) {
    descuento = formato.aDecimalONulo(cuerpo.descuento);

    if (descuento === null || descuento < 0) {
      throw AppError.validacion('El descuento debe ser un numero mayor o igual a 0', [
        { campo: 'descuento', mensaje: 'Debe ser un numero mayor o igual a 0' }
      ]);
    }
    if (descuento > subtotal) {
      throw AppError.validacion('El descuento no puede superar el subtotal', [
        { campo: 'descuento', mensaje: 'No puede superar el subtotal de la reserva' }
      ]);
    }
    if (descuento > 0 && detalles.length < DESCUENTO.SERVICIOS_MINIMOS) {
      // RN-04: con menos de 3 servicios el descuento no es aplicable.
      throw AppError.validacion(MENSAJES.NEGOCIO.DESCUENTO_NO_APLICABLE, [
        { campo: 'descuento', mensaje: MENSAJES.NEGOCIO.DESCUENTO_NO_APLICABLE }
      ]);
    }
  } else {
    // Sin descuento explicito: el negocio aplica el % automatico
    // cuando la reserva alcanza el minimo de servicios.
    descuento =
      detalles.length >= DESCUENTO.SERVICIOS_MINIMOS
        ? formato.redondearDosDecimales(subtotal * (DESCUENTO.PORCENTAJE / 100))
        : 0;
  }

  datos.subtotal = formato.redondearDosDecimales(subtotal);
  datos.descuento = formato.redondearDosDecimales(descuento);

  // --- 409: conflicto de horario/espacio (fase 34) ----------------------
  // Se comprueba DESPUES del colector: primero 400, luego 409.
  const hayConflicto = await reservaRepository.existeConflicto(
    {
      tipoEspacio: datos.tipo_espacio,
      identificadorEspacio: datos.identificador_espacio,
      fecha: datos.fecha,
      hora: datos.hora
    },
    idActual
  );

  if (hayConflicto) {
    throw AppError.conflicto(MENSAJES.NEGOCIO.CONFLICTO_HORARIO, [
      {
        campo: 'hora',
        mensaje: MENSAJES.NEGOCIO.CONFLICTO_HORARIO
      }
    ]);
  }

  return { datos, detalles };
}

class ReservaService {
  /** ?estado=&idCliente=&fecha=&tipoEspacio=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = ESTADOS_PERMITIDOS.includes(filtros.estado) ? filtros.estado : null;
    const idCliente = formato.aEnteroONulo(filtros.idCliente);
    const fechaIso = fechas.aFechaISO(filtros.fecha);
    const fecha = fechaIso === null ? null : fechaIso.slice(0, 10);
    const tipoEspacio = TIPOS_PERMITIDOS.includes(filtros.tipoEspacio) ? filtros.tipoEspacio : null;
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);

    const { total, filas } = await reservaRepository.listar({
      estado, idCliente, fecha, tipoEspacio, busqueda, pagina, limite
    });
    return { reservas: filas, total, pagina, limite };
  }

  /** Cabecera SIN lineas. */
  async obtenerPorId(id) {
    const reserva = await reservaRepository.obtenerPorId(id);
    if (reserva === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('reserva'));
    }
    return reserva.toJSON();
  }

  /** Cabecera CON sus lineas (lectura natural de la composicion). */
  async obtenerConDetalles(id) {
    const reserva = await reservaRepository.obtenerConDetalles(id);
    if (reserva === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('reserva'));
    }
    return reserva.toJSON();
  }

  /** Alta en transaccion: reserva + lineas o nada. */
  async crear(cuerpo) {
    const { datos, detalles } = await preparar(cuerpo);
    const id = await reservaRepository.crearConDetalles(datos, detalles);
    return this.obtenerConDetalles(id);
  }

  /** Edicion en transaccion (solo pendiente). */
  async actualizar(id, cuerpo) {
    const actual = await this.obtenerPorId(id);

    if (!actual.pendiente) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.RESERVA_NO_EDITABLE);
    }

    const { datos, detalles } = await preparar(cuerpo, actual.estado, id);
    await reservaRepository.actualizarConDetalles(id, datos, detalles);
    return this.obtenerConDetalles(id);
  }

  /**
   * Cambiar estado (fase 34): 'confirmada' o 'cancelada'.
   *  - confirmar: solo desde 'pendiente' -> 409.
   *  - cancelar: desde 'pendiente' o 'confirmada' -> 409 si ya estaba
   *    cancelada (mensaje RESERVA_NO_CANCELABLE).
   */
  async cambiarEstado(id, cuerpo) {
    const reserva = await this.obtenerPorId(id);

    const colector = new ColectorErrores();
    colector.exigirValorDeLista('estado', cuerpo?.estado, [
      ESTADO_RESERVA.CONFIRMADA,
      ESTADO_RESERVA.CANCELADA
    ]);
    colector.lanzarSiHay();

    const destino = cuerpo.estado;

    if (destino === ESTADO_RESERVA.CONFIRMADA && reserva.estado !== ESTADO_RESERVA.PENDIENTE) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.RESERVA_NO_CONFIRMABLE);
    }

    if (destino === ESTADO_RESERVA.CANCELADA && reserva.estado === ESTADO_RESERVA.CANCELADA) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.RESERVA_NO_CANCELABLE);
    }

    await reservaRepository.cambiarEstado(id, destino);
    return this.obtenerConDetalles(id);
  }

  /** Baja fisica (solo pendiente; lineas caen en cascada). */
  async eliminar(id) {
    const reserva = await this.obtenerPorId(id);

    if (!reserva.pendiente) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.RESERVA_NO_EDITABLE);
    }

    await reservaRepository.eliminar(id);
    return reserva;
  }
}

// Singleton.
module.exports = new ReservaService();
