/**
 * src/services/auth.service.js
 * ---------------------------------------------------------------------
 * CAPA DE SERVICIO de AUTENTICACION (el "portero" del sistema).
 *
 * FLUJOS QUE RESUELVE
 * ---------------------------------------------------------------------
 *   login     -> verifica credenciales, firma JWT, registra el intento.
 *   logout    -> solo registra el cierre en bitacora (el JWT se tira
 *                en el cliente; ver "POR QUE EL LOGOUT NO REVoca").
 *   registro  -> crea la cuenta PUBLICA con rol por defecto y la deja
 *                lista con su token (auto-login).
 *   mi perfil -> leer/editar los datos PROPIOS (nunca rol ni estado).
 *
 * POR QUE EL LOGOUT NO "REVOCa" EL TOKEN?
 * Porque el JWT es una credencial AUTONOMA: el servidor no guarda
 * sesiones y no puede borrar un token que ya esta en el telefono del
 * cliente. El logout honesto consiste en:
 *   1. registrar el evento en `accesos` (auditoria) y
 *   2. pedirle al cliente que DESCARTE el token.
 * Si un token "logueado fuera" llega igual, seguira valido hasta su
 * expiracion (2h por defecto). Para cortes INMEDIATOS ya existe el
 * estado inactivo del usuario, que la autenticacion verifica en cada
 * peticion (ver middleware/autenticacion.js).
 *
 * REGLAS DE NEGOCIO QUE RESUELVE
 *   1. clave mala o correo inexistente -> 401 CREDENCIALES_INVALIDAS
 *      (el MISMO mensaje para ambos: si dijera "ese correo no existe",
 *      un atacante podria enumerar cuentas).
 *   2. cuenta correcta pero DESACTIVADA -> 403 USUARIO_INACTIVO.
 *   3. registro con el rol `cliente` SIEMPRE (nunca elige el cliente
 *      su propio rol: eso seria escalada de privilegios).
 *   4. al editar el perfil propio NO se puede tocar idRol, estado ni
 *      contrasena (lista blanca estricta).
 */

const AppError = require('../utils/AppError');
const MENSAJES = require('../utils/mensajes');
const formato = require('../utils/formato');
const configuracion = require('../config/env');
const tokens = require('../utils/tokens');
const { Acceso } = require('../models');
const { TIPO_ACCION_ACCESO, RESULTADO_ACCESO, SEGURIDAD } = require('../utils/constants');
const usuarioRepository = require('../repositories/UsuarioRepository');
const rolRepository = require('../repositories/RolRepository');
const accesoRepository = require('../repositories/AccesoRepository');
const usuarioService = require('./usuario.service');

// Campos que el cliente puede cambiar en SU PROPIO perfil. idRol,
// estado y contrasena quedan FUERA a proposito.
const CAMPOS_PERFIL_PROPIO = ['nombre', 'apellido', 'email', 'telefono'];

// Campos que acepta el registro publico.
const CAMPOS_REGISTRO = ['nombre', 'apellido', 'email', 'contrasena', 'telefono'];

class AuthService {
  /**
   * LOGIN: verifica credenciales y firma el token de sesion.
   *
   * @param {object} datos     { email, contrasena }
   * @param {string|null} ipOrigen  req.ip (para la bitacora).
   * @returns {Promise<{token: string, expiracion: string, usuario: object}>}
   */
  async login(datos = {}, ipOrigen = null) {
    const email = formato.aMinusculas(datos.email ?? '');
    const contrasena = typeof datos.contrasena === 'string' ? datos.contrasena : '';

    const usuario = await usuarioRepository.obtenerPorEmail(email);
    const coincide = usuario !== null ? await usuario.contrasenaCoincide(contrasena) : false;

    // --- Clave mala o correo inexistente: mismo 401 para los dos. ---
    if (!coincide) {
      // Solo se puede auditar si el usuario EXISTE: id_usuario es FK
      // NOT NULL, no hay a quien atribuirle el intento de un correo
      // inventado.
      if (usuario !== null) {
        await this.#registrar(usuario.id, TIPO_ACCION_ACCESO.LOGIN, ipOrigen, RESULTADO_ACCESO.FALLIDO);
      }

      throw AppError.noAutenticado(MENSAJES.NEGOCIO.CREDENCIALES_INVALIDAS);
    }

    // --- Clave correcta pero cuenta dada de baja: corte visible. ---
    if (!usuario.estaActivo()) {
      await this.#registrar(usuario.id, TIPO_ACCION_ACCESO.LOGIN, ipOrigen, RESULTADO_ACCESO.FALLIDO);
      throw AppError.sinPermiso(MENSAJES.NEGOCIO.USUARIO_INACTIVO);
    }

    await this.#registrar(usuario.id, TIPO_ACCION_ACCESO.LOGIN, ipOrigen, RESULTADO_ACCESO.EXITOSO);

    // Payload MINIMO: id basta para identificar; el resto se recarga
    // de la base en cada peticion (ver middleware de autenticacion).
    const token = tokens.firmar({
      id: usuario.id,
      email: usuario.email,
      idRol: usuario.idRol
    });

    return {
      token,
      expiracion: configuracion.autenticacion.expiracion,
      usuario: usuario.toJSON()
    };
  }

  /**
   * LOGOUT: registra el cierre de sesion en bitacora.
   *
   * @param {number} idUsuario  Ya viene de req.usuario (token valido).
   * @param {string|null} ipOrigen
   * @returns {Promise<{mensaje: string}>}
   */
  async logout(idUsuario, ipOrigen = null) {
    await this.#registrar(idUsuario, TIPO_ACCION_ACCESO.LOGOUT, ipOrigen, RESULTADO_ACCESO.EXITOSO);

    return {
      mensaje: 'Sesion cerrada. Descarta el token del cliente.'
    };
  }

  /**
   * REGISTRO PUBLICO: crea la cuenta con el rol por defecto y
   * devuelve el token (auto-login).
   *
   * @param {object} datos  { nombre, apellido, email, contrasena, telefono? }
   * @param {string|null} ipOrigen
   * @returns {Promise<{token: string, expiracion: string, usuario: object}>}
   */
  async registro(datos = {}, ipOrigen = null) {
    // El id del rol NUNCA se acepta del cliente: se busca por nombre.
    const rolCliente = await rolRepository.obtenerPorNombre(SEGURIDAD.ROL_CLIENTE_DEFECTO);

    if (rolCliente === null) {
      // Es un problema de INSTALACION (falta correr el seed), no del
      // cliente: 500 con mensaje accionable para quien opera el server.
      throw AppError.interno(
        `No existe el rol "${SEGURIDAD.ROL_CLIENTE_DEFECTO}". Ejecuta el seed de la base de datos.`
      );
    }

    // Lista blanca: se descarta cualquier idRol/estado/etc. que mande.
    const datosLimpios = formato.soloCamposPermitidos(datos, CAMPOS_REGISTRO);

    // usuarioService.crear ya valida formato, unicidad de correo y
    // hashea la clave con bcrypt. Se le inyecta el rol SIEMPRE al
    // final, para que gane sobre cualquier intento previo.
    const usuario = await usuarioService.crear({ ...datosLimpios, idRol: rolCliente.id });

    await this.#registrar(usuario.id, TIPO_ACCION_ACCESO.REGISTRO, ipOrigen, RESULTADO_ACCESO.EXITOSO);

    const token = tokens.firmar({
      id: usuario.id,
      email: usuario.email,
      idRol: usuario.idRol
    });

    return {
      token,
      expiracion: configuracion.autenticacion.expiracion,
      usuario: usuario.toJSON()
    };
  }

  /**
   * MI PERFIL (lectura): los datos propios con el rol resuelto.
   *
   * @param {number} idUsuario
   * @returns {Promise<Usuario>}
   */
  async obtenerMiPerfil(idUsuario) {
    return usuarioService.obtenerPorId(idUsuario);
  }

  /**
   * MI PERFIL (edicion): nombre, apellido, email y telefono.
   *
   * Reutiliza usuarioService.actualizar con una lista blanca: aunque
   * el cliente mande `{ idRol: 1, estado: 'activo' }`, esos campos se
   * descartan ANTES de llegar a la validacion.
   *
   * @param {number} idUsuario
   * @param {object} datosCrudos
   * @param {string|null} ipOrigen
   * @returns {Promise<Usuario>}
   */
  async editarMiPerfil(idUsuario, datosCrudos = {}, ipOrigen = null) {
    const datosLimpios = formato.soloCamposPermitidos(datosCrudos, CAMPOS_PERFIL_PROPIO);

    if (Object.keys(datosLimpios).length === 0) {
      throw AppError.validacion('Debes enviar al menos un dato a actualizar (nombre, apellido, email o telefono).');
    }

    const usuario = await usuarioService.actualizar(idUsuario, datosLimpios);

    await this.#registrar(idUsuario, TIPO_ACCION_ACCESO.EDICION_PERFIL, ipOrigen, RESULTADO_ACCESO.EXITOSO);

    return usuario;
  }

  // ==================================================================
  // PRIVADAS
  // ==================================================================

  /**
   * Graba un evento en la bitacora de accesos.
   *
   * Se llama en TODOS los caminos (exitosos y fallidos). Si la
   * bitacora falla, el login NO se rompe: AccesoRepository.registrar
   * ya traga el error y solo lo deja impreso en el servidor.
   *
   * @param {number} idUsuario
   * @param {string} tipoAccion
   * @param {string|null} ipOrigen
   * @param {string} resultado
   */
  async #registrar(idUsuario, tipoAccion, ipOrigen, resultado) {
    await accesoRepository.registrar(
      Acceso.desdeJSON({ idUsuario, tipoAccion, ipOrigen, resultado })
    );
  }
}

// SINGLETON
module.exports = new AuthService();
