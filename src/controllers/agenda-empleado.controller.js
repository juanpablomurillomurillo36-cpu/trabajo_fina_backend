/**
 * src/controllers/agenda-empleado.controller.js
 * ---------------------------------------------------------------------
 * HTTP -> AgendaEmpleadoService. Bitacora en cada mutacion (C8).
 */

const respuesta = require('../utils/respuesta');
const MENSAJES = require('../utils/mensajes');
const agendaEmpleadoService = require('../services/agenda-empleado.service');
const bitacoraService = require('../services/bitacora.service');
const { ACCION_BITACORA } = require('../utils/constants');
const { capturarAsync } = require('../middleware/errorHandler');

const TABLA = 'agenda_empleados';

class AgendaEmpleadoController {
  /** GET /api/agenda */
  listar = capturarAsync(async (req, res) => {
    const { turnos, total, pagina, limite } = await agendaEmpleadoService.listar(req.query);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.LISTA('turnos de agenda'),
      datos: turnos,
      meta: respuesta.construirMeta({ total, pagina, limite, devueltos: turnos.length })
    });
  });

  /** GET /api/agenda/:id */
  obtenerPorId = capturarAsync(async (req, res) => {
    const turno = await agendaEmpleadoService.obtenerPorId(req.idsValidados.id);

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.DETALLE('Turno de agenda'),
      datos: turno
    });
  });

  /** POST /api/agenda -> 201 + Location */
  crear = capturarAsync(async (req, res) => {
    const turno = await agendaEmpleadoService.crear(req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.CREACION,
      idRegistro: turno.id,
      detalle: `Turno ${turno.fecha} ${turno.horaInicio} para el empleado #${turno.idEmpleado} creado`
    });

    res.set('Location', `/api/agenda/${turno.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.CREADO('Turno de agenda'),
      datos: turno
    });
  });

  /** PUT /api/agenda/:id */
  actualizar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const turno = await agendaEmpleadoService.actualizar(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Turno #${id} editado: ${turno.fecha} ${turno.horaInicio}`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ACTUALIZADO('Turno de agenda'),
      datos: turno
    });
  });

  /** PATCH /api/agenda/:id/estado */
  cambiarEstado = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const turno = await agendaEmpleadoService.cambiarEstado(id, req.body);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.EDICION,
      idRegistro: id,
      detalle: `Estado del turno #${id}: ahora "${turno.estado}"`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.OPERACION_REALIZADA('Cambio de estado'),
      datos: turno
    });
  });

  /** DELETE /api/agenda/:id */
  eliminar = capturarAsync(async (req, res) => {
    const id = req.idsValidados.id;
    const turno = await agendaEmpleadoService.eliminar(id);

    await bitacoraService.registrarDesdeReq(req, {
      tabla: TABLA,
      accion: ACCION_BITACORA.ANULACION,
      idRegistro: id,
      detalle: `Turno #${id} (${turno.fecha} ${turno.horaInicio}) eliminado`
    });

    return respuesta.exito(res, {
      mensaje: MENSAJES.EXITO.ELIMINADO('Turno de agenda'),
      datos: turno
    });
  });
}

// Singleton.
module.exports = new AgendaEmpleadoController();
