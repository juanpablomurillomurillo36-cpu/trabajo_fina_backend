/**
 * src/utils/constants.js
 * ---------------------------------------------------------------------
 * CENTRO DE CONSTANTES del dominio.
 *
 * POR QUE EXISTE ESTE ARCHIVO?
 *
 * 1. UNICA FUENTE DE VERDAD. Los valores de las columnas ENUM de MySQL
 *    estan escritos aqui UNA sola vez. Si mañana "pendiente" pasa a
 *    "espera", se cambia en un lugar y no hay que buscarlo a mano por
 *    los 26 modelos.
 *
 * 2. ERROR EN TIPOGRAFIA = ERROR EN TIEMPO DE EJECUCION. Si escribo
 *    `ESTADO.ACTOO` el programa revienta de inmediato al intentar leer
 *    `undefined`, en lugar de guardar silenciosamente una cadena basura
 *    en la base de datos.
 *
 * 3. AUTODESCRIPCION. `ESTADO.ACTIVO` se lee mejor que el texto crudo
 *    'activo' repartido por el codigo: indica intencion, no solo dato.
 *
 * REGLA DE ORO: los VALORES tienen que ser EXACTAMENTE los que declara
 * `database/01_schema.sql`. Si aqui dice 'activo' y en MySQL enum
 * ('activo','inactivo') tambien, la consulta funciona. Si difieren,
 * MySQL devuelve un error de columna invalida en el INSERT.
 *
 * POR QUE Object.freeze?
 * Devuelve una copia inmutable: `ESTADO.ACTIVO = 'borrar'` no hace
 * nada (en modo estricto lanza TypeError). Protege contra escrituras
 * accidentales desde cualquier modulo.
 */

// =====================================================================
// 1. ESTADOS GENERICOS (la mayoria de tablas usan esta pareja)
// ---------------------------------------------------------------------
// roles, permisos, usuarios, clientes, productos, servicios,
// proveedores, empleados, categoria_clientes, categoria_empleado.
// =====================================================================
const ESTADO = Object.freeze({
  ACTIVO: 'activo',
  INACTIVO: 'inactivo'
});

// =====================================================================
// 2. ESTADOS POR ENTIDAD
// ---------------------------------------------------------------------
// Cada tabla tiene SU enum. No se unifican a proposito: "pendiente"
// de una venta y "pendiente" de una reserva son cosas distintas que
// podrian evolucionar por separado.
// =====================================================================

/** compras.estado */
const ESTADO_COMPRA = Object.freeze({
  PENDIENTE: 'pendiente',
  CONFIRMADA: 'confirmada',
  ANULADA: 'anulada'
});

/** reservas.estado */
const ESTADO_RESERVA = Object.freeze({
  PENDIENTE: 'pendiente',
  CONFIRMADA: 'confirmada',
  CANCELADA: 'cancelada'
});

/** ventas.estado */
const ESTADO_VENTA = Object.freeze({
  PENDIENTE: 'pendiente',
  PAGADA: 'pagada',
  ANULADA: 'anulada'
});

/** evento.estado */
const ESTADO_EVENTO = Object.freeze({
  PROGRAMADO: 'programado',
  EN_CURSO: 'en_curso',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado'
});

/** agenda_empleados.estado y agenda_eventos.estado (mismo enum) */
const ESTADO_AGENDA = Object.freeze({
  PROGRAMADA: 'programada',
  COMPLETADA: 'completada',
  CANCELADA: 'cancelada'
});

/** ingresos.estado */
const ESTADO_INGRESO = Object.freeze({
  VALIDO: 'valido',
  RECHAZADO: 'rechazado'
});

/** notificaciones.estado */
const ESTADO_NOTIFICACION = Object.freeze({
  PENDIENTE: 'pendiente',
  ENVIADA: 'enviada',
  FALLIDA: 'fallida'
});

// =====================================================================
// 3. TIPOS (no son estados: son CATEGORIAS de un dato)
// =====================================================================

/** evento.tipo_evento */
const TIPO_EVENTO = Object.freeze({
  TEMATICO: 'tematico',
  FIESTA_PRIVADA: 'fiesta_privada'
});

/** notificaciones.tipo */
const TIPO_NOTIFICACION = Object.freeze({
  PROMOCION: 'promocion',
  EVENTO: 'evento',
  CUMPLEANOS: 'cumpleanos',
  RECORDATORIO: 'recordatorio'
});

/** notificaciones.canal */
const CANAL_NOTIFICACION = Object.freeze({
  EMAIL: 'email',
  SMS: 'sms'
});

/** reservas.tipo_espacio */
const TIPO_ESPACIO = Object.freeze({
  VIP: 'vip',
  MESA: 'mesa'
});

/** ventas.metodo_pago */
const METODO_PAGO = Object.freeze({
  EFECTIVO: 'efectivo',
  TARJETA: 'tarjeta',
  TRANSFERENCIA: 'transferencia'
});

/** categoria_empleado.nombre (los 4 cargos fijos de la casa) */
const CARGO_EMPLEADO = Object.freeze({
  DJ: 'DJ',
  MESERO: 'mesero',
  INGRESO: 'ingreso',
  ADMINISTRATIVO: 'administrativo'
});

// =====================================================================
// 4. AUDITORIA Y ACCESO
// =====================================================================

/** bitacora.accion */
const ACCION_BITACORA = Object.freeze({
  CREACION: 'CREACION',
  EDICION: 'EDICION',
  ANULACION: 'ANULACION'
});

/** accesos.tipo_accion */
const TIPO_ACCION_ACCESO = Object.freeze({
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTRO: 'registro',
  EDICION_PERFIL: 'edicion_perfil',
  RECUPERAR_PASSWORD: 'recuperar_password',
  RESTABLECER_PASSWORD: 'restablecer_password'
});

/** accesos.resultado */
const RESULTADO_ACCESO = Object.freeze({
  EXITOSO: 'exitoso',
  FALLIDO: 'fallido'
});

// =====================================================================
// 5. REGLAS DE NEGOCIO NUMERICAS
// ---------------------------------------------------------------------
// Tambien viven aqui porque las usan los validadores y los services.
// Cambian con el negocio, no con la base de datos.
// =====================================================================
const LIMITES = Object.freeze({
  // Longitudes de columna (VARCHAR) de las tablas de esta fase.
  NOMBRE_ROL: 50,
  DESCRIPCION: 255,
  NOMBRE_PERMISO: 80,
  NOMBRE_USUARIO: 60,
  CORREO: 120,
  TELEFONO: 20,

  // Paginacion: nunca se le pide a la base mas de esto de un tiro.
  LIMITE_PAGINA: 100,
  LIMITE_DEFECTO: 20,

  // Contrasena: minimo 8 caracteres (regla R-CLAVE-01).
  CONTRASENA_MIN: 8,
  CONTRASENA_MAX: 72 // bcrypt no procesa nada mas alla de 72 bytes.
});

const IVA = Object.freeze({ PORCENTAJE: 16 });

const AFORO = Object.freeze({ MAXIMO: 200 });

const DESCUENTO = Object.freeze({ MAXIMO: 100 });

const PUNTOS = Object.freeze({
  // Puntos que gana el cliente por cada 100 pesos gastados.
  POR_CADA_100: 1
});

const SEGURIDAD = Object.freeze({
  // Rounds de bcrypt. 12 es el equilibrio recomendado entre seguridad
  // y tiempo de respuesta (~200-300 ms por hash).
  BCRYPT_ROUNDS: 12,
  MINIMO_PERMISOS_ROL: 1 // un rol jamas puede quedar sin permisos
});

// =====================================================================
// 6. CODIGOS HTTP Y DE ERROR (los usa la capa de respuesta)
// =====================================================================
const HTTP = Object.freeze({
  OK: 200,
  CREADO: 201,
  SIN_CONTENIDO: 204,
  BAD_REQUEST: 400,
  NO_AUTENTICADO: 401,
  SIN_PERMISO: 403,
  NO_ENCONTRADO: 404,
  METODO_NO_PERMITIDO: 405,
  CONFLICTO: 409,
  ERROR_INTERNO: 500,
  SERVICIO_NO_DISPONIBLE: 503
});

/**
 * Codigos de error INTERNOS de la API. Son el "nombre tecnico" que
 * viaja en `error.codigo`. El frontend puede hacer switch sobre ellos
 * sin tener que adivinar mirando el mensaje en espanol.
 */
const CODIGO_ERROR = Object.freeze({
  VALIDACION: 'VALIDACION',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  CONFLICTO: 'CONFLICTO',
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  SIN_PERMISO: 'SIN_PERMISO',
  BASE_DE_DATOS: 'BASE_DE_DATOS',
  INTERNO: 'INTERNO',
  RUTA_NO_ENCONTRADA: 'RUTA_NO_ENCONTRADA',
  CUERPO_INVALIDO: 'CUERPO_INVALIDO',
  PARAMETRO_INVALIDO: 'PARAMETRO_INVALIDO',
  LLAVE_FORANEA: 'LLAVE_FORANEA'
});

module.exports = {
  ESTADO,
  ESTADO_COMPRA,
  ESTADO_RESERVA,
  ESTADO_VENTA,
  ESTADO_EVENTO,
  ESTADO_AGENDA,
  ESTADO_INGRESO,
  ESTADO_NOTIFICACION,
  TIPO_EVENTO,
  TIPO_NOTIFICACION,
  CANAL_NOTIFICACION,
  TIPO_ESPACIO,
  METODO_PAGO,
  CARGO_EMPLEADO,
  ACCION_BITACORA,
  TIPO_ACCION_ACCESO,
  RESULTADO_ACCESO,
  LIMITES,
  IVA,
  AFORO,
  DESCUENTO,
  PUNTOS,
  SEGURIDAD,
  HTTP,
  CODIGO_ERROR
};
