/**
 * src/services/usuario.service.js
 * ---------------------------------------------------------------------
 * CAPA DE SERVICIO de la entidad Usuario.
 *
 * REGLAS DE NEGOCIO QUE RESUELVE
 *   1. Correo UNICO                -> 409 CORREO_DUPLICADO.
 *   2. El rol indicado DEBE existir -> 400 (evita el error crudo de la FK).
 *   3. La contrasena NUNCA se      -> se hashea con bcrypt ANTES de
 *      guarda en claro                 persistir; el modelo solo recibe
 *                                      el hash.
 *   4. Fortaleza de la contrasena  -> 400 CONTRASENA_DEBIL (8+ chars,
 *      letra y numero) del ColectorErrores.
 *   5. No se borra una cuenta con  -> 409 (accesos, bitacora e
 *      referencias vivas               ingresos la referencian).
 *   6. Cuenta inactiva no entra    -> se decide en la fase 20 (login).
 *
 * POR QUE EL HASH SE HACE AQUI Y NO EN EL MODELO?
 * Porque hashear es ASINCRONO (bcrypt tarda ~100ms a proposito) y un
 * constructor sincrono no puede esperar. Ademas, asi el service es el
 * UNICO punto donde la contrasena en claro existe, y desaparece en la
 * siguiente linea. Es el principio de menor privilegio aplicado a
 * datos: el repository jamas ve una clave en claro.
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const cifrado = require('../utils/cifrado');
const { ColectorErrores } = require('../utils/validadores');
const { LIMITES, ESTADO } = require('../utils/constants');
const { Usuario } = require('../models');
const usuarioRepository = require('../repositories/UsuarioRepository');

// Lista blanca de campos admisibles en el cuerpo de la peticion.
const CAMPOS_PERMITIDOS = [
  'nombre',
  'apellido',
  'email',
  'telefono',
  'idRol',
  'estado',
  'contrasena'
];

const ESTADOS_PERMITIDOS = [ESTADO.ACTIVO, ESTADO.INACTIVO];

// usuarios.telefono: VARCHAR(20) NULL.
const MAXIMO_TELEFONO = 20;

class UsuarioService {
  /**
   * LISTAR usuarios con filtros y paginacion.
   *
   * Filtros admitidos: ?estado=&busqueda=&idRol=&pagina=&limite=
   *
   * @param {object} filtros  req.query
   * @returns {Promise<{usuarios: Usuario[], total, pagina, limite}>}
   */
  async listar(filtros = {}) {
    const pagina = Math.max(1, formato.aEnteroONulo(filtros.pagina) ?? LIMITES.PAGINA_DEFECTO);
    const limite = Math.min(
      Math.max(1, formato.aEnteroONulo(filtros.limite) ?? LIMITES.LIMITE_DEFECTO),
      LIMITES.LIMITE_MAXIMO
    );

    const estado = this.#normalizarEstadoConsulta(filtros.estado);
    const busqueda = formato.limpiarTexto(filtros.busqueda ?? filtros.buscar);
    const idRol = formato.aEnteroONulo(filtros.idRol);

    const { usuarios, total } = await usuarioRepository.listar({
      estado,
      busqueda,
      idRol,
      pagina,
      limite
    });

    return { usuarios, total, pagina, limite };
  }

  /**
   * OBTENER un usuario por id.
   *
   * @param {number} id
   * @returns {Promise<Usuario>}
   * @throws {AppError} 404
   */
  async obtenerPorId(id) {
    const usuario = await usuarioRepository.obtenerPorId(id);

    if (usuario === null) {
      throw AppError.noEncontrado(MENSAJES.NEGOCIO.NO_EXISTE('usuario'));
    }

    return usuario;
  }

  /**
   * CREAR una cuenta de usuario.
   *
   * @param {object} datosCrudos  req.body
   * @returns {Promise<Usuario>} La cuenta creada, sin contrasena ni hash.
   */
  async crear(datosCrudos) {
    const datos = this.#normalizar(datosCrudos);

    this.#validarCreacion(datos);

    // Reglas de negocio que necesitan consultar la base:
    //   - correo unico (409)
    //   - rol existente (400)
    await this.#verificarCorreoUnico(datos.email);
    await this.#verificarRolExistente(datos.idRol);

    // PASO CRITICO: aqui la contrasena en claro deja de existir.
    const contrasenaHash = await cifrado.hashearPassword(datos.contrasena);

    const usuario = Usuario.desdeJSON({ ...datos, contrasenaHash });

    usuario.id = await usuarioRepository.crear(usuario);

    return usuario;
  }

  /**
   * ACTUALIZAR un usuario (parcial).
   *
   * La contrasena es opcional: si NO viene, se conserva la actual
   * (el repository no la toca). Si viene, se valida y se hashea.
   *
   * @param {number} id
   * @param {object} datosCrudos
   * @returns {Promise<Usuario>}
   */
  async actualizar(id, datosCrudos) {
    const usuario = await this.obtenerPorId(id);

    const datos = this.#normalizar(datosCrudos);
    this.#validarActualizacion(datos);

    // Solo se re-validan las relaciones/reglas de los campos que
    // llegaron: editar el telefono no deberia exigir que el rol siga
    // existiendo.
    if (Object.hasOwn(datos, 'email')) {
      await this.#verificarCorreoUnico(datos.email, id);
      usuario.email = datos.email;
    }

    if (Object.hasOwn(datos, 'idRol')) {
      await this.#verificarRolExistente(datos.idRol);
      usuario.idRol = datos.idRol;
    }

    if (Object.hasOwn(datos, 'nombre')) usuario.nombre = datos.nombre;
    if (Object.hasOwn(datos, 'apellido')) usuario.apellido = datos.apellido;
    if (Object.hasOwn(datos, 'telefono')) usuario.telefono = datos.telefono;
    if (Object.hasOwn(datos, 'estado')) usuario.estado = datos.estado;

    await usuarioRepository.actualizar(id, usuario);

    // La contrasena se procesa aparte porque requiere OTRA consulta
    // (UPDATE exclusivo) y otro flujo (hashear).
    if (Object.hasOwn(datos, 'contrasena')) {
      const hash = await cifrado.hashearPassword(datos.contrasena);
      await usuarioRepository.cambiarContrasena(id, hash);
      usuario.contrasenaHash = hash;
    }

    return usuario;
  }

  /**
   * CAMBIAR el estado de la cuenta.
   *
   * @param {number} id
   * @param {object} datosCrudos  { estado }
   * @returns {Promise<Usuario>}
   */
  async cambiarEstado(id, datosCrudos) {
    const usuario = await this.obtenerPorId(id);

    const errores = new ColectorErrores();
    errores.exigirValorDeLista('estado', datosCrudos?.estado, ESTADOS_PERMITIDOS);
    errores.lanzarSiHay('No se pudo cambiar el estado del usuario.');

    await usuarioRepository.cambiarEstado(id, datosCrudos.estado);

    usuario.estado = datosCrudos.estado;

    return usuario;
  }

  /**
   * ELIMINAR una cuenta.
   *
   * @param {number} id
   * @returns {Promise<object>} Resumen de lo borrado.
   * @throws {AppError} 404 si no existe, 409 si tiene historial.
   */
  async eliminar(id) {
    const usuario = await this.obtenerPorId(id);

    const referencias = await usuarioRepository.contarReferencias(id);

    if (referencias.total > 0) {
      throw AppError.conflicto(
        MENSAJES.NEGOCIO.EN_USO('usuario', 'accesos, bitacora e ingresos'),
        [
          {
            campo: 'referencias',
            mensaje:
              `La cuenta tiene ${referencias.accesos} acceso(s), ${referencias.bitacora} ` +
              `registro(s) de bitacora y ${referencias.ingresos} ingreso(s) validados. ` +
              'Desactiva la cuenta en su lugar: conserva el historial sin perder trazabilidad.'
          }
        ]
      );
    }

    await usuarioRepository.eliminar(id);

    return {
      id: usuario.id,
      email: usuario.email,
      nombreCompleto: usuario.nombreCompleto,
      referencias
    };
  }

  // ==================================================================
  // PRIVADAS
  // ==================================================================

  /**
   * Filtra el cuerpo contra la lista blanca.
   *
   * @param {object} datosCrudos
   * @returns {object}
   */
  #normalizar(datosCrudos) {
    const filtrados = formato.soloCamposPermitidos(datosCrudos, CAMPOS_PERMITIDOS);
    const limpios = {};

    // Los nombres pasan a "Titulo Propio": "ANA maria" -> "Ana Maria".
    if (Object.hasOwn(filtrados, 'nombre')) {
      limpios.nombre = formato.aTituloPropio(filtrados.nombre);
    }

    if (Object.hasOwn(filtrados, 'apellido')) {
      limpios.apellido = formato.aTituloPropio(filtrados.apellido);
    }

    // El correo se limpia aqui y el modelo ademas lo pasa a minusculas.
    if (Object.hasOwn(filtrados, 'email')) {
      limpios.email = formato.limpiarTexto(filtrados.email);
    }

    if (Object.hasOwn(filtrados, 'telefono')) {
      limpios.telefono = formato.limpiarTexto(filtrados.telefono);
    }

    if (Object.hasOwn(filtrados, 'idRol')) {
      // Si era un texto no numerico se conserva tal cual, para que
      // exigirEntero reporte el error real en vez de "obligatorio".
      limpios.idRol = formato.aEnteroONulo(filtrados.idRol) ?? filtrados.idRol;
    }

    if (Object.hasOwn(filtrados, 'estado')) {
      limpios.estado = filtrados.estado;
    }

    // La contrasena se recorta pero NUNCA se transforma mas alla de
    // eso: se hashea tal cual llega.
    if (Object.hasOwn(filtrados, 'contrasena')) {
      limpios.contrasena =
        typeof filtrados.contrasena === 'string' ? filtrados.contrasena : filtrados.contrasena;
    }

    return limpios;
  }

  /**
   * Valida la CREACION: todos los campos obligatorios de la tabla.
   *
   * @param {object} datos
   * @throws {AppError} 400 con TODOS los errores juntos.
   */
  #validarCreacion(datos) {
    const errores = new ColectorErrores();

    // Columnas NOT NULL de `usuarios`.
    errores.exigirTexto('nombre', datos.nombre, { maximo: LIMITES.VARCHAR_MEDIO });
    errores.exigirTexto('apellido', datos.apellido, { maximo: LIMITES.VARCHAR_MEDIO });
    errores.exigirCorreo('email', datos.email, { maximo: LIMITES.VARCHAR_LARGO });
    errores.exigirContrasena('contrasena', datos.contrasena);
    errores.exigirEntero('idRol', datos.idRol, { minimo: 1 });

    // Columnas opcionales.
    errores.exigirTexto('telefono', datos.telefono, {
      requerido: false,
      maximo: MAXIMO_TELEFONO
    });
    errores.exigirValorDeLista('estado', datos.estado, ESTADOS_PERMITIDOS, {
      requerido: false
    });

    errores.lanzarSiHay('No se pudo crear el usuario porque hay datos invalidos.');
  }

  /**
   * Valida la ACTUALIZACION: todos los campos opcionales.
   *
   * @param {object} datos
   * @throws {AppError} 400
   */
  #validarActualizacion(datos) {
    if (formato.estaVacio(datos)) {
      throw AppError.validacion('Debes enviar al menos un campo valido para actualizar.', [
        { campo: 'cuerpo', mensaje: `Campos admitidos: ${CAMPOS_PERMITIDOS.join(', ')}.` }
      ]);
    }

    const errores = new ColectorErrores();

    if (Object.hasOwn(datos, 'nombre')) {
      errores.exigirTexto('nombre', datos.nombre, { maximo: LIMITES.VARCHAR_MEDIO });
    }
    if (Object.hasOwn(datos, 'apellido')) {
      errores.exigirTexto('apellido', datos.apellido, { maximo: LIMITES.VARCHAR_MEDIO });
    }
    if (Object.hasOwn(datos, 'email')) {
      errores.exigirCorreo('email', datos.email, { maximo: LIMITES.VARCHAR_LARGO });
    }
    if (Object.hasOwn(datos, 'contrasena')) {
      errores.exigirContrasena('contrasena', datos.contrasena);
    }
    if (Object.hasOwn(datos, 'idRol')) {
      errores.exigirEntero('idRol', datos.idRol, { minimo: 1 });
    }
    if (Object.hasOwn(datos, 'telefono')) {
      errores.exigirTexto('telefono', datos.telefono, {
        requerido: false,
        maximo: MAXIMO_TELEFONO
      });
    }
    if (Object.hasOwn(datos, 'estado')) {
      errores.exigirValorDeLista('estado', datos.estado, ESTADOS_PERMITIDOS);
    }

    errores.lanzarSiHay('No se pudo actualizar el usuario porque hay datos invalidos.');
  }

  /**
   * Unicidad del correo (409 si ya tiene cuenta).
   *
   * @param {string}      email
   * @param {number|null} [idExcluido]
   * @throws {AppError} 409
   */
  async #verificarCorreoUnico(email, idExcluido = null) {
    const yaExiste = await usuarioRepository.existeEmail(email, idExcluido);

    if (yaExiste) {
      throw AppError.conflicto(MENSAJES.NEGOCIO.CORREO_DUPLICADO(email), [
        { campo: 'email', mensaje: 'Ese correo ya tiene una cuenta.' }
      ]);
    }
  }

  /**
   * El rol referenciado debe existir (400 si no).
   *
   * @param {*} idRol
   * @throws {AppError} 400
   */
  async #verificarRolExistente(idRol) {
    const existe = await usuarioRepository.existeRol(idRol);

    if (!existe) {
      throw AppError.validacion('El rol indicado no existe.', [
        { campo: 'idRol', mensaje: 'Selecciona un rol valido del sistema.' }
      ]);
    }
  }

  /**
   * Valida el filtro ?estado= del listado.
   *
   * @param {*} valor
   * @returns {string|null}
   * @throws {AppError} 400
   */
  #normalizarEstadoConsulta(valor) {
    const texto = formato.limpiarTexto(valor);

    if (texto === null) return null;

    if (!ESTADOS_PERMITIDOS.includes(texto)) {
      throw AppError.validacion('El filtro de estado no es valido.', [
        { campo: 'estado', mensaje: `Valores admitidos: ${ESTADOS_PERMITIDOS.join(', ')}.` }
      ]);
    }

    return texto;
  }
}

// SINGLETON
module.exports = new UsuarioService();
