/**
 * src/utils/mensajes.js
 * ---------------------------------------------------------------------
 * CENTRO DE TEXTOS que viajan al cliente.
 *
 * POR QUE NO ESCRIBIR LOS MENSAJES DENTRO DE CADA SERVICE?
 *
 * 1. UN SOLO LUGAR PARA CORREGIR UNA TYPOGRAFIA. Si "registro" esta
 *    mal escrito en diez archivos hay que buscarlo diez veces.
 *
 * 2. UNA API QUE HABLA UN IDIOMA. Aqui los mensajes salen en espanol
 *    latinoamericano; en una fase internacional se reemplaza este
 *    archivo y ningun service se entera.
 *
 * 3. COHERENCIA. Dos endpoints que hacen lo mismo responden el MISMO
 *    texto, lo que hace predecible la documentacion y las pruebas.
 *
 * ESTRUCTURA: tres grupos.
 *   - EXITO    -> se usan cuando todo salio bien (200/201).
 *   - VALIDACION -> datos mal formados o fuera de rango (400).
 *   - NEGOCIO  -> el dato es valido pero la REGLA DEL NEGOCIO lo
 *                 rechaza (404, 409).
 *   - SISTEMA  -> mensajes internos (logs y arranque).
 *
 * NOTA: algunos son funciones (VARIABLE_ENTORNO_FALTANTE) porque
 * necesitan interpolarte un dato; los demas son cadenas simples.
 */

const EXITO = Object.freeze({
  RECURSO_LISTADO: 'Listado consultado correctamente',
  RECURSO_OBTENIDO: 'Registro encontrado',
  RECURSO_CREADO: 'Registro creado correctamente',
  RECURSO_ACTUALIZADO: 'Registro actualizado correctamente',
  RECURSO_ESTADO_ACTUALIZADO: 'Estado actualizado correctamente',
  RECURSO_ELIMINADO: 'Registro eliminado correctamente',
  PERMISO_ASIGNADO: 'Permiso asignado al rol correctamente',
  PERMISO_QUITADO: 'Permiso retirado del rol correctamente',
  CONSULTA_EXITOSA: 'Consulta realizada con exito'
});

const VALIDACION = Object.freeze({
  CUERPO_VACIO: 'El cuerpo de la peticion esta vacio',
  CUERPO_NO_OBJETO: 'El cuerpo de la peticion debe ser un objeto JSON',
  PARAMETRO_NO_NUMERICO: 'El parametro de la ruta debe ser un numero entero positivo',
  DATOS_INVALIDOS: 'La peticion contiene datos invalidos',
  CORREO_INVALIDO: 'El correo electronico no tiene un formato valido',
  CONTRASENA_DEBIL:
    'La contrasena debe tener 8 caracteres o mas e incluir al menos una letra y un numero',
  CAMPO_REQUERIDO: (campo) => `El campo "${campo}" es obligatorio`,
  CAMPO_DEMASIADO_LARGO: (campo, maximo) =>
    `El campo "${campo}" no puede superar los ${maximo} caracteres`,
  VALOR_NO_PERMITIDO: (campo, valores) =>
    `El campo "${campo}" solo acepta: ${valores.join(', ')}`
});

const NEGOCIO = Object.freeze({
  // ---- Roles ----
  ROL_NO_EXISTE: (id) => `No existe el rol con id ${id}`,
  ROL_DUPLICADO: (nombre) => `Ya existe un rol llamado "${nombre}"`,
  ROL_SIN_PERMISOS:
    'Operacion rechazada: un rol no puede quedar sin permisos',
  ROL_TIENE_USUARIOS:
    'No se puede eliminar: existen usuarios asignados a este rol',

  // ---- Permisos ----
  PERMISO_NO_EXISTE: (id) => `No existe el permiso con id ${id}`,
  PERMISO_DUPLICADO: (nombre) => `Ya existe el permiso "${nombre}"`,
  PERMISO_YA_ASIGNADO:
    'Ese permiso ya esta asignado a este rol',
  PERMISO_NO_ASIGNADO:
    'Ese permiso no esta asignado a este rol',

  // ---- Usuarios ----
  USUARIO_NO_EXISTE: (id) => `No existe el usuario con id ${id}`,
  CORREO_DUPLICADO: (correo) => `El correo "${correo}" ya esta registrado`,
  ROL_INVALIDO: (idRol) => `No existe el rol ${idRol} para asignar al usuario`,
  USUARIO_EN_USO:
    'No se puede eliminar: el usuario tiene historial en el sistema',

  // ---- Genericos ----
  EN_USO: 'No se puede eliminar: el registro esta siendo utilizado',
  RECURSO_NO_ENCONTRADO: 'El recurso solicitado no existe'
});

const SISTEMA = Object.freeze({
  VARIABLE_ENTORNO_FALTANTE: (nombre) =>
    `Falta la variable de entorno obligatoria "${nombre}". ` +
    'Copia .env.example a src/.env y completala.',
  BASE_DE_DATOS_NO_DISPONIBLE: 'MySQL no responde. Revisa el servicio y las credenciales.',
  RUTA_DESACTIVADA: 'Ese recurso todavia no esta disponible en esta fase del proyecto.',
  RUTA_NO_ENCONTRADA: (metodo, url) => `No existe el recurso ${metodo} ${url}`,
  JSON_MAL_FORMADO: 'El cuerpo de la peticion no es un JSON valido',
  ERROR_INTERNO: 'Se presento un error interno inesperado. Intenta de nuevo mas tarde.'
});

module.exports = { EXITO, VALIDACION, NEGOCIO, SISTEMA };
