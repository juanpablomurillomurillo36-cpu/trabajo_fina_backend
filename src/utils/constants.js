/**
 * src/utils/constants.js
 * ---------------------------------------------------------------------
 * Constantes de toda la aplicacion.
 *
 * POR QUE EXISTE ESTE ARCHIVO? (regla R-DRY: no repetir codigo)
 *
 *   Los textos que se repiten en muchos lugares se definen UNA sola vez
 *   aqui. Si mañana hay que cambiar 'confirmada' por 'aprobada', se
 *   toca este archivo y listo: no hay que buscar en 20 carpetas.
 *
 *   Ademas, el editor del codigo (y el compilador) avisan si se escribe
 *   mal una constante, cosa que NO pasa con cadenas sueltas en el codigo.
 *
 * TODOS los valores coinciden EXACTAMENTE con las columnas ENUM de la
 * base de datos `discoteca_api`. Si cambias un ENUM en MySQL, cambialo
 * aqui tambien.
 */

// ---------------------------------------------------------------------
// ESTADOS GENERICOS (columna ENUM 'activo' / 'inactivo')
// Se usa en: roles, permisos, usuarios, productos, proveedores,
//            servicios, clientes, empleados y categorias.
// ---------------------------------------------------------------------
const ESTADO = Object.freeze({
  ACTIVO: 'activo',
  INACTIVO: 'inactivo'
});

// ---------------------------------------------------------------------
// COMPRAS  (columna compras.estado)
// RN-01: una compra nace 'pendiente'; al confirmarse suma stock,
//        al anularse NO suma stock.
// ---------------------------------------------------------------------
const ESTADO_COMPRA = Object.freeze({
  PENDIENTE: 'pendiente',
  CONFIRMADA: 'confirmada',
  ANULADA: 'anulada'
});

// ---------------------------------------------------------------------
// RESERVAS  (columna reservas.estado)
// ---------------------------------------------------------------------
const ESTADO_RESERVA = Object.freeze({
  PENDIENTE: 'pendiente',
  CONFIRMADA: 'confirmada',
  CANCELADA: 'cancelada'
});

// ---------------------------------------------------------------------
// VENTAS  (columna ventas.estado)
// RN-09: al pagar pasa de 'pendiente' a 'pagada'.
// ---------------------------------------------------------------------
const ESTADO_VENTA = Object.freeze({
  PENDIENTE: 'pendiente',
  PAGADA: 'pagada',
  ANULADA: 'anulada'
});

// ---------------------------------------------------------------------
// EVENTOS  (columna evento.estado)
// ---------------------------------------------------------------------
const ESTADO_EVENTO = Object.freeze({
  PROGRAMADO: 'programado',
  EN_CURSO: 'en_curso',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado'
});

// Columna evento.tipo_evento (C-07, fase 48): permite el comparativo
// RF-DES-10 entre eventos tematicos y fiestas privadas.
const TIPO_EVENTO = Object.freeze({
  TEMATICO: 'tematico',
  FIESTA_PRIVADA: 'fiesta_privada'
});

// ---------------------------------------------------------------------
// AGENDAS (agenda_empleados.estado y agenda_eventos.estado)
// ---------------------------------------------------------------------
const ESTADO_AGENDA = Object.freeze({
  PROGRAMADA: 'programada',
  COMPLETADA: 'completada',
  CANCELADA: 'cancelada'
});

// ---------------------------------------------------------------------
// INGRESOS (columna ingresos.estado) - validacion del codigo QR
// RN-05: un QR vigente no se puede usar dos veces.
// ---------------------------------------------------------------------
const ESTADO_INGRESO = Object.freeze({
  VALIDO: 'valido',
  RECHAZADO: 'rechazado'
});

// ---------------------------------------------------------------------
// ACCESOS (tablas accesos) - bitacora de login/logout
// ---------------------------------------------------------------------
const TIPO_ACCION_ACCESO = Object.freeze({
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTRO: 'registro',
  EDICION_PERFIL: 'edicion_perfil',
  RECUPERAR_PASSWORD: 'recuperar_password',
  RESTABLECER_PASSWORD: 'restablecer_password'
});

const RESULTADO_ACCESO = Object.freeze({
  EXITOSO: 'exitoso',
  FALLIDO: 'fallido'
});

// ---------------------------------------------------------------------
// BITACORA (columna bitacora.accion) - auditoria de datos
// Coinciden en MAYUSCULAS con el ENUM de la base.
// ---------------------------------------------------------------------
const ACCION_BITACORA = Object.freeze({
  CREACION: 'CREACION',
  EDICION: 'EDICION',
  ANULACION: 'ANULACION'
});

// ---------------------------------------------------------------------
// NOTIFICACIONES (tabla notificaciones) - simuladas
// RN-12: se guardan en la base y se registran en consola.
// ---------------------------------------------------------------------
const TIPO_NOTIFICACION = Object.freeze({
  PROMOCION: 'promocion',
  EVENTO: 'evento',
  CUMPLEANOS: 'cumpleanos',
  RECORDATORIO: 'recordatorio'
});

const CANAL_NOTIFICACION = Object.freeze({
  EMAIL: 'email',
  SMS: 'sms'
});

const ESTADO_NOTIFICACION = Object.freeze({
  PENDIENTE: 'pendiente',
  ENVIADA: 'enviada',
  FALLIDA: 'fallida'
});

// ---------------------------------------------------------------------
// OTROS DOMINIOS
// ---------------------------------------------------------------------

/** Espacio que se reserva (reservas.tipo_espacio). */
const TIPO_ESPACIO = Object.freeze({
  VIP: 'vip',
  MESA: 'mesa'
});

/** Como paga el cliente (ventas.metodo_pago). */
const METODO_PAGO = Object.freeze({
  EFECTIVO: 'efectivo',
  TARJETA: 'tarjeta',
  TRANSFERENCIA: 'transferencia'
});

/** Roles de personal (categoria_empleado.nombre). */
const CARGO_EMPLEADO = Object.freeze({
  DJ: 'DJ',
  MESERO: 'mesero',
  INGRESO: 'ingreso',
  ADMINISTRATIVO: 'administrativo'
});

// ---------------------------------------------------------------------
// LIMITES
// Protegen la API: evitan paginas absurdas, textos eternos, etc.
// ---------------------------------------------------------------------
const LIMITES = Object.freeze({
  // Paginacion por defecto del listado.
  PAGINA_DEFECTO: 1,
  LIMITE_DEFECTO: 20,

  // Tope de filas por peticion. Aunque pidan limite=100000, aqui se
  // corta. Evita que alguien tumbe la API pidiendo un millon de filas.
  LIMITE_MAXIMO: 100,

  // Longitudes de texto (coinciden con los VARCHAR de la base).
  VARCHAR_CORTO: 45,
  VARCHAR_ROL: 50,
  VARCHAR_MEDIO: 80,
  VARCHAR_LARGO: 120,
  VARCHAR_DESCRIPCION: 255
});

// ---------------------------------------------------------------------
// SEGURIDAD / AUTENTICACION
// ---------------------------------------------------------------------

/**
 * Rol que recibe quien se registra POR SU CUENTA (endpoint publico).
 *
 * POR QUE NO SE LE DEJE ELEGIR?
 * Porque si el cliente pudiera mandar `idRol: 1` en el registro,
 * se autoasignaria el rol admin y la autorizacion no serviria de nada.
 * El id del rol se busca en la base por este NOMBRE, nunca se acepta
 * del cliente.
 *
 * El seed de la fase 49 crea el rol con exactamente este nombre.
 */
const SEGURIDAD = Object.freeze({
  ROL_CLIENTE_DEFECTO: 'cliente',

  /** Vida util del codigo de recuperacion de contrasena (minutos). */
  VIDA_CODIGO_MINUTOS: 15,

  /**
   * Intentos MAXIMOS para verificar un codigo antes de invalidarlo.
   * Con 6 digitos (10^6 combinaciones) y solo 5 intentos, la fuerza
   * bruta es inviable: el codigo caduca ademas en 15 minutos.
   */
  INTENTOS_CODIGO_MAX: 5
});

// ---------------------------------------------------------------------
// REGLAS DE NEGOCIO PARAMETRIZADAS
// ---------------------------------------------------------------------

/** IVA de Mexico (16%). RN-10. */
const IVA = Object.freeze({
  PORCENTAJE: 16
});

/** Fidelizacion (RN-11): 1 punto por cada $10 gastados. */
const PUNTOS = Object.freeze({
  GASTO_POR_PUNTO: 10,
  /** Porcentaje del saldo que se puede canjear: 50%. */
  PORCENTAJE_CANJE: 50
});

/** Descuento por comprar 3 o mas servicios (RN-04). */
const DESCUENTO = Object.freeze({
  SERVICIOS_MINIMOS: 3,
  PORCENTAJE: 10
});

/** Aforo de la discoteca (RN-06 / SAF). */
const AFORO = Object.freeze({
  /** Se dispara la alerta al 90% de ocupacion. */
  PORCENTAJE_ALERTA: 90,
  /** Al 100% se bloquean las reservas nuevas. */
  PORCENTAJE_BLOQUEO: 100
});

module.exports = {
  ESTADO,
  ESTADO_COMPRA,
  ESTADO_RESERVA,
  ESTADO_VENTA,
  ESTADO_EVENTO,
  TIPO_EVENTO,
  ESTADO_AGENDA,
  ESTADO_INGRESO,
  TIPO_ACCION_ACCESO,
  RESULTADO_ACCESO,
  ACCION_BITACORA,
  SEGURIDAD,
  TIPO_NOTIFICACION,
  CANAL_NOTIFICACION,
  ESTADO_NOTIFICACION,
  TIPO_ESPACIO,
  METODO_PAGO,
  CARGO_EMPLEADO,
  LIMITES,
  IVA,
  PUNTOS,
  DESCUENTO,
  AFORO
};
