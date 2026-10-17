/**
 * src/repositories/ProveedorRepository.js
 * ---------------------------------------------------------------------
 * Acceso a datos de `proveedores`. AQUI vive el SQL, con parametros
 * SIEMPRE posicionales (?); nunca se concatenan valores.
 *
 * Singleton: module.exports = new ProveedorRepository().
 */

const db = require('../config/database');
const Proveedor = require('../models/Proveedor');
const { Filtros } = require('../utils/consulta');
const { ESTADO } = require('../utils/constants');

class ProveedorRepository {
  /**
   * Listado paginado con filtros opcionales (estado y busqueda de
   * texto libre sobre nombre, nit y email).
   *
   * @param {{estado?:string, busqueda?:string, pagina:number, limite:number}} opciones
   * @returns {Promise<{total:number, filas:Proveedor[]}>}
   */
  async listar({ estado, busqueda, pagina, limite } = {}) {
    const filtros = new Filtros();

    if (estado) filtros.agregar('p.estado = ?', estado);
    if (busqueda) {
      filtros.agregarBusquedaMulti(['p.nombre', 'p.nit', 'p.email'], busqueda);
    }

    const where = filtros.obtenerWhere();
    const offset = (pagina - 1) * limite;

    // OJO: db.obtenerUno devuelve la FILA (objeto), no un arreglo.
    const totalFila = await db.obtenerUno(
      `SELECT COUNT(*) AS total FROM proveedores p ${where}`,
      filtros.obtenerParametros()
    );

    const filas = await db.ejecutar(
      `SELECT p.* FROM proveedores p
        ${where}
        ORDER BY p.nombre ASC
        LIMIT ? OFFSET ?`,
      [...filtros.obtenerParametros(), limite, offset]
    );

    return {
      total: Number(totalFila.total),
      filas: filas.map(Proveedor.desdeFila)
    };
  }

  /**
   * Busqueda por id.
   *
   * @param {number} id
   * @returns {Promise<Proveedor|null>}
   */
  async obtenerPorId(id) {
    const fila = await db.obtenerUno(
      'SELECT * FROM proveedores WHERE id_proveedor = ?',
      [id]
    );
    return Proveedor.desdeFila(fila);
  }

  /**
   * Verifica si el NIT ya esta registrado. Se busca entre TODOS los
   * registros (activos e inactivos) porque `uq_proveedores_nit` es un
   * indice unico a nivel de tabla: MySQL rechazaria el INSERT aunque
   * el registro duplicado este inactivo.
   *
   * @param {string} nit
   * @param {number|null} idExcluido Se ignora este id (para ediciones).
   * @returns {Promise<boolean>}
   */
  async existeNit(nit, idExcluido = null) {
    const sql = idExcluido
      ? 'SELECT 1 AS existe FROM proveedores WHERE nit = ? AND id_proveedor <> ?'
      : 'SELECT 1 AS existe FROM proveedores WHERE nit = ?';
    const params = idExcluido ? [nit, idExcluido] : [nit];

    const fila = await db.obtenerUno(sql, params);
    return Boolean(fila);
  }

  /**
   * Cuantos compras referencian a este proveedor (FK
   * `compras.id_proveedor`). Se usa para impedir un DELETE que romperia
   * integridad referencial (409 en el service).
   *
   * @param {number} id
   * @returns {Promise<number>}
   */
  async contarCompras(id) {
    const fila = await db.obtenerUno(
      'SELECT COUNT(*) AS total FROM compras WHERE id_proveedor = ?',
      [id]
    );
    return Number(fila.total);
  }

  /**
   * Alta de proveedor.
   *
   * @param {object} fila Valores en snake_case (aFilaBaseDatos()).
   * @returns {Promise<number>} id insertado.
   */
  async crear(fila) {
    const resultado = await db.ejecutar(
      `INSERT INTO proveedores (nombre, nit, telefono, email, direccion, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fila.nombre,
        fila.nit,
        fila.telefono,
        fila.email,
        fila.direccion,
        fila.estado
      ]
    );
    return resultado.insertId;
  }

  /**
   * Actualizacion total de los campos editables.
   *
   * @param {number} id
   * @param {object} fila Valores en snake_case.
   * @returns {Promise<boolean>} true si alguna fila cambio.
   */
  async actualizar(id, fila) {
    const resultado = await db.ejecutar(
      `UPDATE proveedores
          SET nombre = ?, nit = ?, telefono = ?, email = ?, direccion = ?,
              estado = ?
        WHERE id_proveedor = ?`,
      [
        fila.nombre,
        fila.nit,
        fila.telefono,
        fila.email,
        fila.direccion,
        fila.estado,
        id
      ]
    );
    return resultado.affectedRows > 0;
  }

  /**
   * Cambio de estado (activo/inactivo) sin tocar los demas campos.
   *
   * @param {number} id
   * @param {string} estado
   * @returns {Promise<boolean>}
   */
  async cambiarEstado(id, estado) {
    const resultado = await db.ejecutar(
      'UPDATE proveedores SET estado = ? WHERE id_proveedor = ?',
      [estado, id]
    );
    return resultado.affectedRows > 0;
  }

  /**
   * Baja fisica.
   *
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async eliminar(id) {
    const resultado = await db.ejecutar(
      'DELETE FROM proveedores WHERE id_proveedor = ?',
      [id]
    );
    return resultado.affectedRows > 0;
  }

  /**
   * Listado sin paginacion (para selects/semillas).
   *
   * @param {string} [estado]
   * @returns {Promise<Proveedor[]>}
   */
  async listarTodos(estado = ESTADO.ACTIVO) {
    const filas = await db.ejecutar(
      `SELECT * FROM proveedores ${estado ? 'WHERE estado = ?' : ''}
        ORDER BY nombre ASC`,
      estado ? [estado] : []
    );
    return filas.map(Proveedor.desdeFila);
  }
}

// Singleton: una sola instancia para toda la app.
module.exports = new ProveedorRepository();
