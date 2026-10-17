/**
 * src/utils/mensajes.js
 * ---------------------------------------------------------------------
 * TODOS los textos que muestra la API viven aqui.
 *
 * POR QUE? (regla R-DRY y ayuda a la consistencia)
 *
 *   - Un mismo mensaje se usa en varios lados y debe decir SIEMPRE lo
 *     mismo. Aqui se define una vez.
 *   - Si el profesor o el frontend piden cambiar una redaccion, se
 *     toca UN archivo.
 *   - Facilita el trabajo en equipo: cada mensaje tiene una LLAVE, y
 *     en las pull requests se discute "cambio el mensaje NEGOCIO.X"
 *     sin pegar todo el texto.
 *
 * ESTRUCTURA
 *   MENSAJES.EXITO     -> 200 / 201
 *   MENSAJES.VALIDACION-> 400 (errores de datos)
 *   MENSAJES.NEGOCIO   -> 404 / 409 (reglas de negocio)
 *   MENSAJES.SISTEMA   -> 500 y arranque
 *
 * Algunos mensajes son FUNCIONES porque llevan parametros:
 *   MENSAJES.EXITO.CREADO('Usuario')  ->  "Usuario creado correctamente"
 */

const MENSAJES = Object.freeze({
  // ==================================================================
  // EXITO (200 / 201)
  // ==================================================================
  EXITO: Object.freeze({
    LISTA: (recurso) => `${recurso} listados correctamente`,
    DETALLE: (recurso) => `${recurso} obtenido correctamente`,
    CREADO: (recurso) => `${recurso} creado correctamente`,
    ACTUALIZADO: (recurso) => `${recurso} actualizado correctamente`,
    ELIMINADO: (recurso) => `${recurso} eliminado correctamente`,
    OPERACION_REALIZADA: (accion) => `${accion} realizada correctamente`,

    // Acceso
    INICIO_SESION: 'Sesion iniciada correctamente',
    CIERRE_SESION: 'Sesion cerrada correctamente',
    PERFIL_ACTUALIZADO: 'Perfil actualizado correctamente',
    CONTRASENA_RESTABLECIDA: 'Contraseña restablecida correctamente',
    CORREO_ENVIADO: 'Si el correo esta registrado, recibiras las instrucciones',

    // Asignaciones N:M
    PERMISO_ASIGNADO: 'Permiso asignado al rol correctamente',
    PERMISO_QUITADO: 'Permiso quitado del rol correctamente',

    // Transacciones
    COMPRA_CONFIRMADA: 'Compra confirmada y stock actualizado',
    COMPRA_ANULADA: 'Compra anulada (el stock no se modifico)',
    VENTA_PAGADA: 'Venta pagada, stock descontado y comprobante generado',
    INGRESO_VALIDADO: 'Codigo QR validado, ingreso permitido'
  }),

  // ==================================================================
  // VALIDACION (400)
  // ==================================================================
  VALIDACION: Object.freeze({
    REQUERIDO: (campo) => `El campo "${campo}" es obligatorio`,
    TEXTO: (campo) => `El campo "${campo}" debe ser texto`,
    LONGITUD_MAXIMA: (campo, maximo) => `El campo "${campo}" no puede superar ${maximo} caracteres`,
    SOLO_LETRAS: (campo) => `El campo "${campo}" solo puede contener letras`,
    CORREO: (campo) => `El campo "${campo}" debe ser un correo electronico valido`,
    FECHA_INVALIDA: (campo) => `El campo "${campo}" debe ser una fecha valida (AAAA-MM-DD)`,
    FECHA_FUTURA: (campo) => `El campo "${campo}" no puede ser una fecha futura`,
    FECHA_PASADA: (campo) => `El campo "${campo}" no puede estar en el pasado`,
    ENTERO: (campo) => `El campo "${campo}" debe ser un numero entero`,
    RANGO: (campo, minimo, maximo) => `El campo "${campo}" debe estar entre ${minimo} y ${maximo}`,
    ID_INVALIDO: (campo) => `El campo "${campo}" debe ser un identificador valido (numero entero positivo)`,
    VALOR_PERMITIDO: (campo, lista) => `El campo "${campo}" debe ser uno de: ${lista.join(', ')}`,
    CORPUS_VACIO: 'Debes enviar el cuerpo de la peticion',
    CORPUS_JSON_INVALIDO: 'El cuerpo de la peticion no es JSON valido',
    PARAMETRO_INVALIDO: (parametro) => `El parametro "${parametro}" no es valido`,
    FORMATO_FECHA_HORA: (campo) => `El campo "${campo}" debe tener formato de fecha y hora valido`,
    HORA_INVALIDA: (campo) => `El campo "${campo}" debe tener formato de hora valido (HH:MM)`
  }),

  // ==================================================================
  // NEGOCIO (404 / 409) - reglas que decide la aplicacion
  // ==================================================================
  NEGOCIO: Object.freeze({
    // Genericos por recurso
    NO_EXISTE: (recurso) => `El ${recurso} solicitado no existe`,
    NOMBRE_DUPLICADO: (recurso, nombre) => `Ya existe un ${recurso} con el nombre "${nombre}"`,
    CORREO_DUPLICADO: (correo) => `Ya existe un usuario con el correo "${correo}"`,
    RFC_DUPLICADO: (rfc) => `Ya existe un registro con el RFC "${rfc}"`,
    NSS_DUPLICADO: (nss) => `Ya existe un empleado con el NSS "${nss}"`,
    NIT_DUPLICADO: (nit) => `Ya existe un proveedor con el NIT "${nit}"`,
    DOCUMENTO_DUPLICADO: (documento) => `Ya existe un registro con el documento "${documento}"`,
    EN_USO: (recurso, tabla) => `No se puede eliminar: el ${recurso} esta en uso en ${tabla}`,

    // Seguridad
    CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos',
    USUARIO_INACTIVO: 'La cuenta esta desactivada. Contacta al administrador',
    CONTRASENA_INCORRECTA: 'La contraseña actual no es correcta',
    CONTRASENA_DEBIL: 'La contraseña debe tener al menos 8 caracteres, una letra y un numero',
    CONTRASENA_NO_COINCIDE: 'La confirmacion no coincide con la contraseña',
    CONTRASENA_IGUAL: 'La nueva contraseña debe ser diferente a la actual',
    JWT_INVALIDO: 'El token de sesion no es valido o ha expirado',
    JWT_FALTANTE: 'Debes incluir el token en la cabecera Authorization',
    SIN_PERMISO: 'No tienes permiso para realizar esta accion',
    ROL_SIN_PERMISOS: 'El rol debe tener al menos un permiso',
    ROL_EN_USO: 'No se puede eliminar: hay usuarios asignados a este rol',
    PERMISO_EN_USO: 'No se puede eliminar: el permiso esta asignado a uno o mas roles',
    PERMISO_NO_EXISTE: 'El permiso solicitado no existe',
    CODIGO_INVALIDO: 'El codigo de recuperacion es invalido, expiro o ya fue utilizado',
    CODIGO_INTENTOS_EXCEDIDOS: 'Demasiados intentos con este codigo; solicita uno nuevo',

    // RN-01 compras
    COMPRA_SIN_DETALLES: 'La compra debe tener al menos un detalle',
    COMPRA_NO_CONFIRMABLE: 'Solo se pueden confirmar compras en estado pendiente',
    COMPRA_NO_ANULABLE: 'Solo se pueden anular compras en estado pendiente',
    COMPRA_NO_EDITABLE: 'Solo se pueden modificar compras pendientes',
    COMPRA_NO_ELIMINABLE: 'Solo se pueden eliminar compras pendientes',
    PRODUCTO_NO_EXISTE_EN_CATALOGO: (nombre) => `El producto "${nombre}" no existe o esta inactivo`,

    // RN-03 inventario
    STOCK_INSUFICIENTE: (nombre, disponible) =>
      `Stock insuficiente para "${nombre}". Disponible: ${disponible}`,
    ABAJO_STOCK_MINIMO: (nombre, minimo) =>
      `El producto "${nombre}" esta por debajo del stock minimo (${minimo})`,
    PRODUCTO_SIN_STOCK: (nombre) => `El producto "${nombre}" no tiene existencias`,

    // RN-02 reservas
    CONFLICTO_HORARIO: 'Ya existe una reserva para ese espacio en ese horario',
    RESERVA_SIN_DETALLES: 'La reserva debe incluir al menos un servicio',
    RESERVA_NO_EDITABLE: 'Solo se pueden editar o eliminar reservas pendientes',
    RESERVA_NO_CANCELABLE: 'Solo se pueden cancelar reservas pendientes o confirmadas',
    RESERVA_NO_CONFIRMABLE: 'Solo se pueden confirmar reservas pendientes',
    RESERVA_YA_INGRESADA: 'El codigo QR de esta reserva ya fue utilizado',
    TURNO_SUPERPUESTO: 'El empleado ya tiene un turno que se superpone en esa fecha',

    // RN-04 calculo de reserva
    DESCUENTO_NO_APLICABLE: 'El descuento aplica a partir de 3 servicios',

    // RN-06 aforo (SAF)
    AFORO_SUPERADO: (maximo) => `El aforo maximo fue alcanzado (${maximo} personas). No se aceptan reservas nuevas`,
    AFORO_ALERTA: (actual, maximo, porcentaje) =>
      `ALERTA DE AFORO: ${actual} de ${maximo} personas (${porcentaje}%). Acercandose al limite`,

    // RN-07 eventos
    EVENTO_SIN_FICHA: 'El evento no tiene ficha tecnica registrada',
    FICHA_DUPLICADA: 'El evento ya tiene una ficha tecnica (solo puede tener una)',
    FICHA_NO_ELIMINABLE: 'No se puede eliminar el evento sin eliminar antes su ficha tecnica',

    // RN-08 agenda
    AGENDA_EN_CONFLICTO: 'Ya existe un evento programado en ese espacio y horario',

    // RN-09 / RN-10 ventas
    VENTA_SIN_DETALLES: 'La venta debe tener al menos un producto',
    VENTA_NO_PAGABLE: 'Solo se pueden pagar ventas en estado pendiente',
    VENTA_NO_ANULABLE: 'Solo se pueden anular ventas pendientes o pagadas',

    // RN-11 puntos
    PUNTOS_INSUFICIENTES: (necesarios, actuales) =>
      `Puntos insuficientes. Necesitas ${necesarios} y tienes ${actuales}`,
    PUNTOS_NO_CANJEABLES: 'No hay puntos disponibles para canjear',

    // RN-12 notificaciones
    NOTIFICACION_FALLO: 'No se pudo procesar la notificacion simulada'
  }),

  // ==================================================================
  // SISTEMA (500 y arranque)
  // ==================================================================
  SISTEMA: Object.freeze({
    ERROR_INTERNO: 'Ocurrio un error inesperado en el servidor',
    BASE_DE_DATOS_NO_DISPONIBLE: 'No se pudo conectar con la base de datos',
    RUTA_NO_ENCONTRADA: (ruta) => `La ruta ${ruta} no existe en esta API`,
    METODO_NO_PERMITIDO: 'Ese metodo no esta permitido en esta ruta',
    VARIABLE_ENTORNO_FALTANTE: (nombre) => `Falta la variable de entorno obligatoria: ${nombre}`,
    BITACORA_NO_REGISTRADA: 'No se pudo registrar la accion en la bitacora'
  })
});

module.exports = MENSAJES;
