/**
 * src/services/notificacion.service.js
 * ---------------------------------------------------------------------
 * NOTIFICACIONES SIMULADAS (RN-12): no existe envio real de email ni
 * SMS; el sistema PERSISTE la notificacion como 'enviada' con su
 * fecha_envio y deja constancia en el log del servidor
 * (registrarInfo -> fecha · nivel · mensaje · detalle, criterio C8).
 *
 * Ademas, la fase 40 integra el aviso MASIVO: al CREAR un evento
 * nuevo, todos los clientes activos reciben una notificacion simulada
 * (ver notificarNuevoEvento).
 *
 * Fase 44 (RF-VEN-15 / RF-EVE-10 / RF-EVE-11):
 *  - notificarCumpleanos(): batch manual (POST /cumpleanos) que deja
 *    una notificacion tipo 'cumpleanos' por cada cliente ACTIVO que
 *    cumplen anos HOY, mas un unico log.
 *  - notificarFechaClaveAgenda(): al crear una actividad de agenda,
 *    los CLIENTES activos reciben un 'recordatorio' persistido, y los
 *    EMPLEADOS del evento quedan solo en el LOG (la columna
 *    id_cliente de `notificaciones` es NOT NULL: no admite empleados).
 *
 * Reglas:
 *  - idCliente debe EXISTIR -> 400; tipo/canal segun ENUM -> 400;
 *    mensaje obligatorio (max 500) -> 400.
 *  Sin try/catch (R-ASYNC).
 */

const notificacionRepository = require('../repositories/NotificacionRepository');
const clienteRepository = require('../repositories/ClienteRepository');
const agendaEmpleadoRepository = require('../repositories/AgendaEmpleadoRepository');
const Notificacion = require('../models/Notificacion');
const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const fechas = require('../utils/fechas');
const { registrarInfo } = require('../middleware/logger');
const { ColectorErrores } = require('../utils/validadores');
const {
  TIPO_NOTIFICACION,
  CANAL_NOTIFICACION,
  ESTADO_NOTIFICACION,
  ESTADO,
  LIMITES
} = require('../utils/constants');

const TIPOS_PERMITIDOS = Object.values(TIPO_NOTIFICACION);
const CANALES_PERMITIDOS = Object.values(CANAL_NOTIFICACION);
// Columna mensaje VARCHAR(500).
const MAXIMO_MENSAJE = 500;

class NotificacionService {
  /** ?tipo=&canal=&estado=&idCliente=&busqueda=&pagina=&limite= */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const tipo = TIPOS_PERMITIDOS.includes(filtros.tipo) ? filtros.tipo : null;
    const canal = CANALES_PERMITIDOS.includes(filtros.canal) ? filtros.canal : null;
    const idCliente = formato.aEnteroONulo(filtros.idCliente);
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);
    const estadoFiltro = Object.values(ESTADO_NOTIFICACION).includes(filtros.estado)
      ? filtros.estado
      : null;

    const { total, filas } = await notificacionRepository.listar({
      tipo, canal, estado: estadoFiltro, idCliente, busqueda, pagina, limite
    });
    return { notificaciones: filas, total, pagina, limite };
  }

  async obtenerPorId(id) {
    const notificacion = await notificacionRepository.obtenerPorId(id);
    if (notificacion === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('notificacion'));
    }
    return notificacion.toJSON();
  }

  /**
   * Envio MANUAL simulado (POST /api/notificaciones).
   *
   * @param {object} cuerpo
   * @returns {Promise<object>} la notificacion ya "enviada".
   */
  async crear(cuerpo) {
    const colector = new ColectorErrores();

    colector.exigirId('idCliente', cuerpo?.idCliente);
    colector.exigirValorDeLista('tipo', cuerpo?.tipo, TIPOS_PERMITIDOS);
    colector.exigirValorDeLista('canal', cuerpo?.canal, CANALES_PERMITIDOS);
    colector.exigirTexto('mensaje', cuerpo?.mensaje, { requerido: true, maximo: MAXIMO_MENSAJE });

    const idCliente = formato.aEnteroONulo(cuerpo?.idCliente);
    let clienteOk = false;

    if (idCliente !== null) {
      const cliente = await clienteRepository.obtenerPorId(idCliente);
      clienteOk = cliente !== null;
      colector.agregarSi(!clienteOk, 'idCliente', 'El cliente indicado no existe');
    }

    colector.lanzarSiHay();

    const id = await notificacionRepository.crear({
      id_cliente: idCliente,
      tipo: cuerpo.tipo,
      canal: cuerpo.canal,
      mensaje: formato.limpiarTexto(cuerpo.mensaje),
      fecha_envio: fechas.ahoraEnMySQL(),
      estado: ESTADO_NOTIFICACION.ENVIADA
    });

    const notificacion = await this.obtenerPorId(id);

    registrarInfo('NOTIFICACION_SIMULADA', {
      id: notificacion.id,
      cliente: idCliente,
      tipo: notificacion.tipo,
      canal: notificacion.canal
    });

    return notificacion;
  }

  /**
   * Aviso MASIVO simulado al crear un evento nuevo (fase 40): una
   * notificacion 'evento' por cada cliente ACTIVO, mas un unico aviso
   * en el log con el total de destinatarios.
   *
   * Si no hay clientes activos no se inserta nada (solo el log).
   *
   * @param {object} evento  toJSON() del evento recien creado.
   * @returns {Promise<number>} destinatarios notificados.
   */
  async notificarNuevoEvento(evento) {
    const clientes = await clienteRepository.listarTodos(ESTADO.ACTIVO);

    if (clientes.length === 0) {
      registrarInfo('NOTIFICACION_SIMULADA', {
        evento: evento.id,
        destinatarios: 0,
        motivo: 'sin clientes activos'
      });
      return 0;
    }

    const fecha = fechas.aFechaISO(evento.fecha)?.slice(0, 10) ?? evento.fecha;
    const mensaje =
      `Nuevo evento: "${evento.nombre}" programado el ${fecha}` +
      (evento.horaInicio ? ` a las ${evento.horaInicio}` : '') +
      '. No te lo pierdas.';

    const ahora = fechas.ahoraEnMySQL();
    const notificaciones = clientes.map(
      (cliente) =>
        new Notificacion(
          null,
          cliente.id,
          TIPO_NOTIFICACION.EVENTO,
          CANAL_NOTIFICACION.EMAIL,
          mensaje,
          ahora,
          ESTADO_NOTIFICACION.ENVIADA
        )
    );

    const insertadas = await notificacionRepository.insertarVarias(notificaciones);

    registrarInfo('NOTIFICACION_SIMULADA', {
      evento: evento.id,
      destinatarios: insertadas,
      tipo: TIPO_NOTIFICACION.EVENTO
    });

    return insertadas;
  }

  /**
   * CUMPLEANOS simulado por LOTE (RF-VEN-15, fase 44).
   * Endpoint manual: revisa quienes cumplen anos HOY, les persiste su
   * notificacion tipo 'cumpleanos' y deja UN log con el total.
   *
   * @returns {Promise<{destinatarios:number, fecha:string}>}
   */
  async notificarCumpleanos() {
    const fechaHoy = fechas.ahoraEnMySQL().slice(0, 10);
    const clientes = await clienteRepository.listarCumpleaniosHoy();

    if (clientes.length === 0) {
      registrarInfo('NOTIFICACION_SIMULADA', {
        tipo: TIPO_NOTIFICACION.CUMPLEANOS,
        destinatarios: 0,
        fecha: fechaHoy,
        motivo: 'nadie cumple anos hoy'
      });
      return { destinatarios: 0, fecha: fechaHoy };
    }

    const ahora = fechas.ahoraEnMySQL();
    const notificaciones = clientes.map(
      (cliente) =>
        new Notificacion(
          null,
          cliente.id,
          TIPO_NOTIFICACION.CUMPLEANOS,
          CANAL_NOTIFICACION.EMAIL,
          `Feliz cumpleanos, ${cliente.nombre} ${cliente.apellido}. ` +
            'Que disfrutes tu dia en Discoteca.',
          ahora,
          ESTADO_NOTIFICACION.ENVIADA
        )
    );

    const insertadas = await notificacionRepository.insertarVarias(notificaciones);

    registrarInfo('NOTIFICACION_SIMULADA', {
      tipo: TIPO_NOTIFICACION.CUMPLEANOS,
      destinatarios: insertadas,
      fecha: fechaHoy
    });

    return { destinatarios: insertadas, fecha: fechaHoy };
  }

  /**
   * FECHA CLAVE de agenda (RF-EVE-10 + RF-EVE-11, fase 44): al crear
   * una actividad de agenda del evento:
   *
   *  - EMPLEADOS asignados al evento -> SOLO LOG (RF-EVE-10). La
   *    tabla notificaciones exige id_cliente NOT NULL, asi que no
   *    existe fila posible para empleados; se deja constancia en el
   *    log del servidor (criterio C8).
   *  - CLIENTES activos -> fila persistida con tipo 'recordatorio'
   *    + log con el total (RF-EVE-11).
   *
   * Si no hay clientes activos solo se emite el log.
   *
   * @param {object} actividad toJSON() de la agenda recien creada.
   * @param {object} evento toJSON() del evento de la actividad.
   * @returns {Promise<{empleados:number, clientes:number}>}
   */
  async notificarFechaClaveAgenda(actividad, evento) {
    // --- RF-EVE-10: empleados -> solo log -------------------------------
    const empleados = await agendaEmpleadoRepository.contarPorEvento(evento.id);
    registrarInfo('NOTIFICACION_SIMULADA', {
      rf: 'RF-EVE-10',
      agenda: actividad.id,
      evento: evento.id,
      fecha: actividad.fecha,
      hora: actividad.hora,
      empleados,
      canal: 'log',
      motivo: 'la tabla notificaciones solo admite clientes (id_cliente NOT NULL)'
    });

    // --- RF-EVE-11: clientes -> fila persistida + log -------------------
    const clientes = await clienteRepository.listarTodos(ESTADO.ACTIVO);

    if (clientes.length === 0) {
      registrarInfo('NOTIFICACION_SIMULADA', {
        rf: 'RF-EVE-11',
        agenda: actividad.id,
        destinatarios: 0,
        motivo: 'sin clientes activos'
      });
      return { empleados, clientes: 0 };
    }

    const mensaje =
      `Recordatorio de fecha clave: "${evento.nombre}" el ${actividad.fecha} ` +
      `a las ${actividad.hora}` +
      (actividad.descripcion ? ` - ${actividad.descripcion}` : '') +
      '.';

    const ahora = fechas.ahoraEnMySQL();
    const notificaciones = clientes.map(
      (cliente) =>
        new Notificacion(
          null,
          cliente.id,
          TIPO_NOTIFICACION.RECORDATORIO,
          CANAL_NOTIFICACION.EMAIL,
          mensaje,
          ahora,
          ESTADO_NOTIFICACION.ENVIADA
        )
    );

    const insertadas = await notificacionRepository.insertarVarias(notificaciones);

    registrarInfo('NOTIFICACION_SIMULADA', {
      rf: 'RF-EVE-11',
      agenda: actividad.id,
      destinatarios: insertadas,
      tipo: TIPO_NOTIFICACION.RECORDATORIO
    });

    return { empleados, clientes: insertadas };
  }
}

// Singleton.
module.exports = new NotificacionService();
