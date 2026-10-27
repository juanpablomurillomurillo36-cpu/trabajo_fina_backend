# discoteca-api

API REST del sistema de gestión de una discoteca. Construida con **Node.js + Express + MySQL**,
siguiendo la arquitectura en capas `rutas → controladores → services → modelos → base de datos`.

> **Fase actual:** infraestructura base + entidades **Rol**, **Permiso** y **Usuario**,
> con CRUD completo y sin autenticación (el JWT entra en una fase posterior).

---

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Paso 1 — Inicializar el proyecto](#2-paso-1--inicializar-el-proyecto)
3. [Paso 2 — Archivos de configuración del repositorio](#3-paso-2--archivos-de-configuración-del-repositorio)
4. [Paso 3 — Configuración (`src/config`)](#4-paso-3--configuración-srcconfig)
5. [Paso 4 — Utilidades (`src/utils`)](#5-paso-4--utilidades-srcutils)
6. [Paso 5 — Middleware (`src/middleware`)](#6-paso-5--middleware-srcmiddleware)
7. [Paso 6 — Arranque y punto de salud](#7-paso-6--arranque-y-punto-de-salud)
8. [Paso 7 — Entidad Rol + asignación de permisos](#8-paso-7--entidad-rol--asignación-de-permisos)
9. [Paso 8 — Entidad Permiso](#9-paso-8--entidad-permiso)
10. [Paso 9 — Entidad Usuario](#10-paso-9--entidad-usuario)
11. [Paso 10 — Pruebas con `curl`](#11-paso-10--pruebas-con-curl)
12. [Paso 10b — Pruebas manuales en Postman (22 requests)](#12-paso-10b--pruebas-manuales-en-postman-22-requests)
13. [Paso 11 — Códigos de error de la API](#13-paso-11--códigos-de-error-de-la-api)
14. [Estructura final del proyecto](#14-estructura-final-del-proyecto)

---

## 1. Requisitos previos

| Requisito | Versión mínima | Cómo verificarlo |
|---|---|---|
| Node.js | 18 (probado con 24.20.0) | `node -v` |
| npm | 9 (probado con 11.19.0) | `npm -v` |
| MySQL Server | 8.0 | `mysql --version` |

```bash
node -v
npm -v
mysql --version
```

La base de datos `discoteca_api` ya viene creada y sembrada con los scripts de
`database/` (27 tablas, roles 5/6/7, 19 permisos y usuarios de prueba).

**Usuario de aplicación** (mínimo privilegio, creado por `database/02_usuario_app.sql`):

```
usuario:  discoteca_app
clave:    DiscotecaApp2026
base:     discoteca_api
```

---

## 2. Paso 1 — Inicializar el proyecto

```bash
cd "C:\Users\venus\Desktop\TRABAJO-FINAL-SENA\Backend-proyecto discoteca\discoteca-api"
npm init -y
npm pkg set name=discoteca-api
npm pkg set main=src/index.js
npm pkg set type=commonjs
npm pkg set scripts.start="node src/index.js"
npm pkg set scripts.dev="node --watch src/index.js"
npm install express cors mysql2 dotenv bcryptjs
```

**Qué instala cada paquete y por qué:**

| Paquete | Para qué |
|---|---|
| `express` | Marco HTTP: rutas, middlewares y respuestas |
| `cors` | Autoriza al frontend (otro origen) a llamar a la API |
| `mysql2` | Driver de MySQL con *prepared statements* (previene inyección SQL) |
| `dotenv` | Lee `src/.env` y lo copia a `process.env` |
| `bcryptjs` | Hashea las contraseñas (puro JavaScript, sin compilar) |

Resultado final de `package.json`:

```json
{
  "name": "discoteca-api",
  "version": "1.0.0",
  "description": "API REST de la discoteca - Node.js + Express + MySQL (fase: infraestructura, roles, permisos y usuarios)",
  "main": "src/index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  }
}
```

---

## 3. Paso 2 — Archivos de configuración del repositorio

### 3.1 `.gitignore` (nuevo)

Nunca se sube nada que contenga una contraseña ni algo reproducible con un comando.

```gitignore
node_modules/
.env
.env.local
*.log
*.pid
.DS_Store
.idea/
.vscode/
```

### 3.2 `.env.example` (nuevo)

Plantilla **sin secretos** que sí se sube a git. El real es `src/.env` y está ignorado.

```bash
copy .env.example src\.env     # y completar los valores reales
```

```env
PUERTO=3000
NODE_ENV=development

DB_HOST=localhost
DB_PUERTO=3306
DB_USUARIO=discoteca_app
DB_CLAVE=tu_contraseña_real
DB_NOMBRE=discoteca_api
DB_LIMITE_CONEXIONES=10

ORIGENES_PERMITIDOS=http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000
```

---

## 4. Paso 3 — Configuración (`src/config`)

### 4.1 `src/config/env.js`

Carga `.env` **una sola vez** y valida las variables obligatorias (*fail fast*): si falta
`DB_CLAVE`, el servidor **no arranca** en vez de fallar después con un error confuso.

```js
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function obligatoria(nombre) {
  const valor = process.env[nombre];
  if (valor === undefined || String(valor).trim() === '') {
    console.error(`\n[CONFIG] ${MENSAJES.SISTEMA.VARIABLE_ENTORNO_FALTANTE(nombre)}\n`);
    process.exit(1);
  }
  return String(valor).trim();
}

const config = Object.freeze({
  entorno: opcional('NODE_ENV', 'development'),
  puerto: entera('PUERTO', 3000),
  baseDatos: Object.freeze({
    host: opcional('DB_HOST', 'localhost'),
    puerto: entera('DB_PUERTO', 3306),
    usuario: obligatoria('DB_USUARIO'),
    clave: obligatoria('DB_CLAVE'),
    nombre: obligatoria('DB_NOMBRE'),
    limiteConexiones: entera('DB_LIMITE_CONEXIONES', 10)
  }),
  origenesPermitidos: lista('ORIGENES_PERMITIDOS', ['http://localhost:5500']),
  get esDesarrollo() { return this.entorno === 'development'; },
  get esProduccion() { return this.entorno === 'production'; }
});
```

`Object.freeze` lo vuelve **inmutable**: nadie puede hacer `config.puerto = 9999` después
de arrancar.

### 4.2 `src/config/database.js`

Clase `Database` con **pool de conexiones**, **singleton** y **consultas parametrizadas**.

```js
class Database {
  #pool;              // privado: nadie desde afuera puede tocarlo
  #estaConectada;

  get pool() { if (this.#pool === null) this.#crearPool(); return this.#pool; }

  async verificarConexion() { /* getConnection + ping + release */ }
  async ejecutar(sql, parametros = []) { const [f] = await this.pool.execute(sql, parametros); return f; }
  async obtenerUno(sql, parametros = []) { /* primera fila o null */ }
  async conTransaccion(trabajo) { /* beginTransaction / commit / rollback */ }
  async cerrar() { /* pool.end() */ }
}

module.exports = new Database();   // SINGLETON: una sola instancia
```

**La regla de oro:** nunca se concatena texto del cliente en SQL.

```js
// MAL   `SELECT * FROM roles WHERE id_rol = ${id}`
// BIEN  'SELECT * FROM roles WHERE id_rol = ?'   +   [id]
```

### 4.3 `src/config/express.js`

Crea la aplicación **sin arrancar el servidor** (eso permite probarla sin ocupar el puerto).
El orden de los `app.use()` es crítico:

```js
function crearAplicacion() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.origenesPermitidos, exposedHeaders: ['Location'], ... }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(registrarPeticion);          // log
  app.use('/api', rutas);              // rutas de la API
  app.get('/', (req, res) => { ... }); // saludo
  app.use(rutaNoEncontrada);           // 404
  app.use(manejadorErrores);           // errores: SIEMPRE el ultimo
  return app;
}
```

---

## 5. Paso 4 — Utilidades (`src/utils`)

| Archivo | Qué aporta |
|---|---|
| `constants.js` | Todos los valores `ENUM` de MySQL, límites y códigos HTTP |
| `AppError.js` | Error con `status`, `codigo` y `detalles` + fábricas estáticas |
| `respuesta.js` | El "sobre" `{ok, mensaje, datos, meta}` / `{ok:false, error:{...}}` |
| `mensajes.js` | Todos los textos que van al cliente (español latinoamericano) |
| `formato.js` | `limpiarTexto`, `soloCamposPermitidos`, `normalizarPaginacion`… |
| `fechas.js` | Normaliza fechas a ISO (salida) y `Date` (entrada a MySQL) |
| `validadores.js` | `ColectorErrores`: junta TODOS los errores y lanza una sola vez |
| `cifrado.js` | `hashearPassword` / `verificarPassword` con bcrypt |

### 5.1 `constants.js`

```js
const ESTADO = Object.freeze({ ACTIVO: 'activo', INACTIVO: 'inactivo' });

const CARGO_EMPLEADO = Object.freeze({
  DJ: 'DJ', MESERO: 'mesero', INGRESO: 'ingreso', ADMINISTRATIVO: 'administrativo'
});

const LIMITES = Object.freeze({
  NOMBRE_ROL: 50, DESCRIPCION: 255, NOMBRE_PERMISO: 80,
  NOMBRE_USUARIO: 60, CORREO: 120, TELEFONO: 20,
  LIMITE_PAGINA: 100, LIMITE_DEFECTO: 20,
  CONTRASENA_MIN: 8, CONTRASENA_MAX: 72
});

const HTTP = Object.freeze({ OK: 200, CREADO: 201, BAD_REQUEST: 400,
  NO_ENCONTRADO: 404, CONFLICTO: 409, ERROR_INTERNO: 500 });
```

> **Importante:** `src/models/index.js` carga las 26 clases del modelo y varias
> necesitan estos grupos (`ESTADO`, `ACCION_BITACORA`, `CARGO_EMPLEADO`,
> `ESTADO_AGENDA`, `ESTADO_EVENTO`, `TIPO_EVENTO`, `ESTADO_INGRESO`,
> `ESTADO_RESERVA`, `ESTADO_VENTA`, `METODO_PAGO`, `TIPO_ACCION_ACCESO`,
> `RESULTADO_ACCESO`, `TIPO_NOTIFICACION`, `CANAL_NOTIFICACION`,
> `ESTADO_NOTIFICACION`). Si falta uno, **la aplicación revienta en el primer `require`**.

### 5.2 `AppError.js`

```js
class AppError extends Error {
  #status; #codigo; #detalles;

  static validacion(m, d = null)   { return new AppError(m, 400, 'VALIDACION', d); }
  static cuerpoInvalido(m, d = null){ return new AppError(m, 400, 'CUERPO_INVALIDO', d); }
  static noEncontrado(m)           { return new AppError(m, 404, 'NO_ENCONTRADO'); }
  static conflicto(m, d = null)    { return new AppError(m, 409, 'CONFLICTO', d); }
  static interno(m, causa = null)  { return new AppError(m, 500, 'INTERNO', null, causa); }

  aJSON() {
    return { ok: false, error: { codigo: this.#codigo, mensaje: this.message,
                                 detalles: this.#detalles } };
  }
}
```

### 5.3 `validadores.js` — `ColectorErrores`

```js
const errores = new ColectorErrores();
errores.exigirTexto('nombreRol', datos.nombreRol, { maximo: LIMITES.NOMBRE_ROL });
errores.exigirCorreo('email', datos.email);
errores.exigirValorDeLista('estado', datos.estado, Object.values(ESTADO));
errores.lanzarSiHayErrores();   // 400 con TODOS los detalles, de una sola vez
```

Si cada validación lanzara inmediato, el cliente corregiría campo por campo y
reenviaría la petición cinco veces. Aquí recibe los cinco de una vez.

---

## 6. Paso 5 — Middleware (`src/middleware`)

| Archivo | Exporta |
|---|---|
| `logger.js` | `registrar`, `registrarInfo`, `registrarAviso`, `registrarError`, `registrarPeticion`, `COLOR` |
| `errorHandler.js` | `rutaNoEncontrada`, `manejadorErrores`, `traducirErrorMySQL` |
| `validarParametros.js` | `validarIdNumerico`, `exigirCuerpo`, `esEnteroPositivo` |

### 6.1 `errorHandler.js` — traducción de MySQL a HTTP

```js
switch (error.code) {
  case 'ER_DUP_ENTRY':            return AppError.conflicto('El registro ya existe...');   // 409
  case 'ER_NO_REFERENCED_ROW':    return new AppError('El registro referenciado no existe', 400, 'LLAVE_FORANEA');
  case 'ER_ROW_IS_REFERENCED':    return new AppError('Otros registros dependen de el', 409, 'LLAVE_FORANEA');
  case 'ER_DATA_TOO_LONG':        return AppError.validacion('Supera el tamanio permitido'); // 400
  case 'ECONNREFUSED':            return AppError.baseDatos('No se pudo conectar con MySQL'); // 500
  case 'ER_ACCESS_DENIED_ERROR':  return AppError.baseDatos('Credenciales incorrectas');      // 500
  default:                        return null;
}
```

**Regla de Express:** el manejador de errores necesita **4 parámetros** y debe ser el
**último** `app.use()`. Con 3 parámetros Express lo trata como un middleware normal y
nunca se activa.

### 6.2 `try/catch` en cada controlador

Cada método de los controladores abre su propio `try` y, si algo falla,
reenvía el error con `next(error)`:

```js
crear = async (req, res, next) => {
  try {
    const rol = await rolService.crear(req.body);
    res.set('Location', `/api/roles/${rol.id}`);
    return respuesta.creado(res, { mensaje: MENSAJES.EXITO.RECURSO_CREADO, datos: rol });
  } catch (error) {
    next(error);
  }
};
```

Sin ese `catch`, Express **no** atrapa los errores de funciones `async`: la
petición quedaría colgada para siempre.

### 6.3 `validarParametros.js`

```js
router.get('/:id', validarIdNumerico('id'), controlador.obtener);
router.post('/',   exigirCuerpo,           controlador.crear);
```

`GET /api/roles/abc` se rechaza con **400** antes de tocar MySQL (*fail fast*).

---

## 7. Paso 6 — Arranque y punto de salud

### `src/index.js` (ya existente, no se modifica)

Exige cuatro módulos que creamos en los pasos anteriores:

```js
const configuracion = require('./config/env');
const db            = require('./config/database');
const { crearAplicacion } = require('./config/express');
const { registrar, registrarError } = require('./middleware/logger');
```

### Comandos

```bash
npm run dev        # con recarga automática (--watch)
# o
npm start          # una sola vez
```

### Verificación

```bash
curl http://localhost:3000/api/salud
```

```json
{
  "ok": true,
  "mensaje": "Consulta realizada con exito",
  "datos": {
    "api": "activa",
    "baseDatos": "conectada",
    "tiempoActivoSegundos": 12,
    "marcaTiempo": "2026-10-24T22:20:40.757Z"
  }
}
```

Log esperado en consola:

```
[2026-10-24T22:04:58.865Z] INFO  BASE_DE_DATOS_CONECTADA {"host":"localhost","esquema":"discoteca_api"}
[2026-10-24T22:04:58.894Z] INFO  SERVIDOR_INICIADO {"puerto":3000,"entorno":"development",...}
```

Documento de descubrimiento:

```bash
curl http://localhost:3000/api
```

---

## 8. Paso 7 — Entidad Rol + asignación de permisos

### Tabla `roles`

| Columna | Tipo | Restricción |
|---|---|---|
| `id_rol` | INT | PK AUTO_INCREMENT |
| `nombre_rol` | VARCHAR(50) | NOT NULL, **UNIQUE** |
| `descripcion` | VARCHAR(255) | NULL |
| `estado` | ENUM('activo','inactivo') | DEFAULT 'activo' |
| `fecha_creacion` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### Tabla puente `rol_permiso` (relación N:M)

PK compuesta (`id_rol`, `id_permiso`) con `ON DELETE CASCADE` en ambas llaves
foráneas: al borrar un rol, MySQL borra solo las filas puente.

### 8.1 `src/services/rol.service.js`

```js
const COLUMNAS_ROL = 'r.id_rol, r.nombre_rol, r.descripcion, r.estado, r.fecha_creacion';

// Subconsulta correlacionada: evita el problema N+1 y no multiplica filas.
const CONTEO_PERMISOS =
  '(SELECT COUNT(*) FROM rol_permiso rp WHERE rp.id_rol = r.id_rol) AS total_permisos';

class RolService {
  #camposPermitidos = ['nombreRol', 'descripcion', 'estado'];
  #mapaColumnas     = { nombreRol: 'nombre_rol', descripcion, estado };

  async listar(filtros)        { /* estado, busqueda, paginacion */ }
  async obtenerPorId(id)       { /* + carga los permisos con JOIN */ }
  async crear(datos)           { /* valida -> desdeJSON -> INSERT -> devuelve la INSTANCIA con id y fechaCreacion */ }
  async actualizar(id, datos)  { /* PARCIAL: setters + UPDATE dinamico -> relee con obtenerPorId */ }
  async cambiarEstado(id, e)   { /* activar()/desactivar() -> devuelve la MISMA instancia */ }
  async eliminar(id)           { /* cascada en rol_permiso; 409 si tiene usuarios -> { id, nombreRol, permisosLiberados } */ }
  async asignarPermiso(idRol, idPermiso)  { /* transaccion -> devuelve el rol */ }
  async quitarPermiso(idRol, idPermiso)   { /* transaccion -> devuelve el ARREGLO restante */ }
}
```

**Regla de negocio `ROL_SIN_PERMISOS`:** un rol no puede quedar con cero permisos.

```js
const [conteo] = await conexion.execute(
  'SELECT COUNT(*) AS total FROM rol_permiso WHERE id_rol = ?', [idRol]);
if (Number(conteo[0].total) <= SEGURIDAD.MINIMO_PERMISOS_ROL) {
  throw AppError.conflicto(MENSAJES.NEGOCIO.ROL_SIN_PERMISOS);   // 409
}
```

> El estado del rol **no** se revisa al asignar permisos: en la secuencia de Postman el
> rol está `inactivo` (por el `PATCH` anterior) y aun así debe responder **200**.

### 8.2 `src/controllers/rol.controller.js`

Seis métodos de CRUD + dos para el sub-recurso, cada uno con su `try/catch`
que hace `next(error)` hacia el manejador central:

```js
crear = async (req, res, next) => {
  try {
    const rol = await rolService.crear(req.body);
    res.set('Location', `/api/roles/${rol.id}`);
    return respuesta.creado(res, { mensaje: MENSAJES.EXITO.RECURSO_CREADO, datos: rol });
  } catch (error) {
    next(error);
  }
};
```

### 8.3 `src/routes/rol.routes.js`

```js
router.get('/',      rolController.listar);
router.post('/',     exigirCuerpo, rolController.crear);

// El sub-recurso va ANTES de '/:id', si no '/:id' se lo come.
router.post('/:id/permisos',
  validarIdNumerico('id'), exigirCuerpo, rolController.asignarPermiso);
router.delete('/:id/permisos/:idPermiso',
  validarIdNumerico('id'), validarIdNumerico('idPermiso'), rolController.quitarPermiso);

router.get('/:id',    validarIdNumerico('id'), rolController.obtener);
router.put('/:id',    validarIdNumerico('id'), exigirCuerpo, rolController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), exigirCuerpo, rolController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), rolController.eliminar);
```

### Endpoints

| Método | Ruta | Éxito |
|---|---|---|
| GET | `/api/roles` | 200 |
| POST | `/api/roles` | **201 + Location** |
| GET | `/api/roles/:id` | 200 (incluye `permisos[]`) |
| PUT | `/api/roles/:id` | 200 (parcial) |
| PATCH | `/api/roles/:id/estado` | 200 |
| DELETE | `/api/roles/:id` | 200 |
| POST | `/api/roles/:id/permisos` | **200** (`datos.totalPermisos`) |
| DELETE | `/api/roles/:id/permisos/:idPermiso` | **200** (`datos` = arreglo restante) |

---

## 9. Paso 8 — Entidad Permiso

Tabla `permisos`: `id_permiso` PK, `nombre_permiso` VARCHAR(80) **UNIQUE**,
`descripcion` VARCHAR(255), `estado` ENUM. **No tiene `fecha_creacion`.**

```js
class PermisoService {
  #camposPermitidos = ['nombrePermiso', 'descripcion', 'estado'];
  #mapaColumnas     = { nombrePermiso: 'nombre_permiso', descripcion, estado };

  async listar(filtros)   { /* ORDER BY nombre_permiso: el listado de Postman usa
                               lista[0] y lista[1] como permisoAsignarId/2Id */ }
  async obtenerPorId(id)  { /* 404 si no existe */ }
  async crear(datos)      { /* desdeJSON -> INSERT -> devuelve la INSTANCIA; 409 si nombre duplicado */ }
  async actualizar(id, d) { /* PARCIAL: setters + UPDATE dinamico -> relee */ }
  async cambiarEstado(id, e) { /* activar()/desactivar() -> devuelve la MISMA instancia */ }
  async eliminar(id)      { /* rol_permiso tiene CASCADE -> nunca 409 -> { id, nombrePermiso } */ }
}
```

| Método | Ruta | Éxito |
|---|---|---|
| GET | `/api/permisos` | 200 (**≥ 19** registros) |
| POST | `/api/permisos` | **201 + Location** |
| GET | `/api/permisos/:id` | 200 |
| PUT | `/api/permisos/:id` | 200 |
| PATCH | `/api/permisos/:id/estado` | 200 |
| DELETE | `/api/permisos/:id` | 200 |

---

## 10. Paso 9 — Entidad Usuario

Tabla `usuarios`: `id_usuario` PK, `id_rol` FK→`roles` (NOT NULL), `nombre`,
`apellido`, `email` **UNIQUE**, `contrasena_hash` NOT NULL, `telefono`, `estado`,
`fecha_creacion`.

### 10.1 `src/services/usuario.service.js`

```js
const COLUMNAS_USUARIO = `
  u.id_usuario, u.id_rol, u.nombre, u.apellido, u.email,
  u.telefono, u.estado, u.fecha_creacion, r.nombre_rol`;
// OJO: contrasena_hash NO se pide en ninguna lectura.
// Si no se pide, no puede filtrarse por accidente.
```

**Regla #1:** la contraseña jamás viaja en claro.

```js
// al crear: el hash se hashea ANTES de instanciar el modelo
const contrasenaHash = await cifrado.hashearPassword(normalizados.contrasena);
const usuario = Usuario.desdeJSON({ ...datos, contrasenaHash });
usuario.fechaCreacion = fechas.ahoraISO();

const fila = usuario.aFilaBaseDatos();          // { ..., contrasena_hash, ... }
// INSERT usando fila.*   ->   usuario.id = resultado.insertId;
return usuario;                                  // la instancia, sin re-leer

// al actualizar (solo si el PUT la trajo): el hash entra en el MISMO UPDATE
if (entrada.contrasena !== undefined) {
  usuario.contrasenaHash = await cifrado.hashearPassword(normalizados.contrasena);
}
// UPDATE dinamico: solo las columnas de los campos que llegaron
// (contrasena -> contrasena_hash, idRol -> id_rol, ...)
```

Validación de contraseña (regla `R-CLAVE-01`): **8+ caracteres, al menos una letra y un
número** → `Clave1234` pasa, `123` no.

`PUT /api/usuarios/:id` es **parcial**: Postman manda solo `{"telefono": "..."}` y el
resto de los campos se conservan.

**Qué devuelve cada operación** (mismo contrato que el proyecto de ejemplo):

| Operación | Devuelve |
|---|---|
| `POST` | la **instancia creada** con `id` y `fechaCreacion` (sin re-leer; por eso **no trae `nombreRol`**, que solo llega del `INNER JOIN` de los `GET`) |
| `PUT` | el usuario **releído** con `obtenerPorId` |
| `PATCH /estado` | la **misma instancia** ya con `activar()`/`desactivar()` aplicado |
| `DELETE` | `{ id, nombreCompleto, email }` (llave `id`, sin `mensaje`) |

### 10.2 Endpoints

| Método | Ruta | Éxito |
|---|---|---|
| GET | `/api/usuarios` | 200 |
| POST | `/api/usuarios` | **201 + Location** |
| GET | `/api/usuarios/:id` | 200 |
| PUT | `/api/usuarios/:id` | 200 (parcial) |
| PATCH | `/api/usuarios/:id/estado` | 200 |
| DELETE | `/api/usuarios/:id` | 200 |

Ninguna respuesta contiene la cadena `contrasenaHash`: lo garantiza `Usuario.toJSON()`,
que no lo serializa.

---

## 11. Paso 10 — Pruebas con `curl`

> **Consejo en Windows:** PowerShell comilla mal el JSON al pasárselo a `curl`. Escribe
> el cuerpo en un archivo y úsalo con `--data-binary "@archivo.json"`.

```bash
# Crear un rol
echo {"nombreRol":"auditor","descripcion":"Rol de prueba"} > body.json
curl -i -X POST http://localhost:3000/api/roles -H "Content-Type: application/json" --data-binary "@body.json"
```

### Casos felices

```bash
curl http://localhost:3000/api/salud
curl http://localhost:3000/api/roles
curl http://localhost:3000/api/permisos
curl http://localhost:3000/api/usuarios
curl -X POST  http://localhost:3000/api/roles      -H "Content-Type: application/json" --data-binary "@body.json"
curl -X PUT   http://localhost:3000/api/roles/15   -H "Content-Type: application/json" --data-binary "@body.json"
curl -X PATCH http://localhost:3000/api/roles/15/estado -H "Content-Type: application/json" -d '{"estado":"inactivo"}'
curl -X DELETE http://localhost:3000/api/roles/15
```

### Casos negativos

| Prueba | Esperado |
|---|---|
| `GET /api/roles/abc` | **400** `VALIDACION` |
| `GET /api/roles/99999` | **404** `NO_ENCONTRADO` |
| `POST /api/roles` con `nombreRol: "administrador"` | **409** `CONFLICTO` |
| `POST /api/usuarios` con `email` repetido | **409** `CONFLICTO` |
| `POST /api/usuarios` con `idRol: 999` | **400** `VALIDACION` |
| `POST /api/usuarios` con `contrasena: "123"` | **400** (`detalles[0].campo = contrasena`) |
| `POST` con cuerpo `{}` | **400** `CUERPO_INVALIDO` |
| `POST` con JSON roto | **400** `CUERPO_INVALIDO` |
| `PUT` sin campos actualizables | **400** `CUERPO_INVALIDO` |
| `POST /api/roles/:id/permisos` dos veces el mismo | **409** `CONFLICTO` |
| `DELETE /api/roles/:id/permisos/:idPermiso` (el último) | **409** `ROL_SIN_PERMISOS` |
| `DELETE /api/roles/5` (rol con usuarios) | **409** `LLAVE_FORANEA` |

---

## 12. Paso 10b — Pruebas manuales en Postman (22 requests)

No hay colección que importar: todo se hace **paso a paso y a mano**. La
lista completa, con la URL y el body de cada petición para copiar y pegar,
está en [`PRUEBAS.md`](PRUEBAS.md).

### Configuración de cada petición

| Pestaña | Qué hacer |
|---|---|
| **Params** | Nada. Déjala vacía. |
| **Authorization** | Nada (`No Auth`): la API no tiene JWT todavía. |
| **Headers** | Nada: Postman agrega `Content-Type: application/json` solo, al elegir Body → raw → JSON. |
| **Body** | Aquí va el JSON (**raw** → **JSON**). En `GET` y `DELETE`: **none**. |
| **Scripts** | Nada. |
| **Settings** | Nada. |

### Cómo pasar los `id` de una petición a otra

Los ids se copian de la respuesta. Un `POST` contesta:

```json
{ "ok": true, "mensaje": "Registro creado correctamente",
  "datos": { "id": 59, "nombrePermiso": "prueba.postman" } }
```

`datos.id` = **59** → se pega en la URL del siguiente paso:
`http://localhost:3000/api/permisos/59`

Tres reglas:

1. **Los ids no se reutilizan.** Cada `POST` genera uno nuevo y más alto; si
   borras el registro, ese id ya no sirve y el siguiente `DELETE` dará 404.
2. **Una sola barra en la URL.** `//api/permisos` responde 404
   `RUTA_NO_ENCONTRADA`.
3. **`PATCH /:id/estado` solo cambia `estado`** y descarta el resto del body.
   Para editar nombre, descripción, teléfono, etc. se usa `PUT /:id`.

### Orden exacto (22 requests)

**Permiso (6)**

1. `GET /api/permisos` → 200, ≥19 → copia `datos[0].id` y `datos[1].id`
2. `POST /api/permisos` → **201 + Location** → copia `datos.id`
3. `PUT /api/permisos/:id` → 200
4. `GET /api/permisos/:id` → 200
5. `PATCH /api/permisos/:id/estado` → 200
6. `DELETE /api/permisos/:id` → 200

**Rol (10)**

7. `GET /api/roles` → 200, ≥3, encuentra `administrador` → copia su `id`
8. `POST /api/roles` → **201 + Location** → copia `datos.id`
9. `PUT /api/roles/:id` → 200 (`datos.descripcion` cambió)
10. `GET /api/roles/:id` → 200 (aún sin permisos: `permisos: []`)
11. `PATCH /api/roles/:id/estado` → 200 (rol queda **inactivo**)
12. `POST /api/roles/:id/permisos` → **200**, `totalPermisos ≥ 1` ← *rol inactivo, igual 200*
13. `POST /api/roles/:id/permisos` (2.º) → 200, `totalPermisos ≥ 2`
14. `DELETE /api/roles/:id/permisos/:idPermiso` → 200, **`datos.length ≥ 1`** (arreglo)
15. `DELETE /api/roles/:id/permisos/:idPermiso` (2.º) → **409** (no puede quedar vacío)
16. `DELETE /api/roles/:id` → 200 (la cascada limpia `rol_permiso`)

**Usuario (6)**

17. `GET /api/usuarios` → 200, ≥3, **sin `contrasenaHash`**
18. `POST /api/usuarios` → **201** → copia `datos.id`
19. `GET /api/usuarios/:id` → 200, **sin `contrasenaHash`**
20. `PUT /api/usuarios/:id` → 200 (solo manda `telefono`)
21. `PATCH /api/usuarios/:id/estado` → 200
22. `DELETE /api/usuarios/:id` → 200

**Fuera de alcance (404 esperada):** `bitacora`, `proveedores`, `productos`,
`servicios`, `categorias/clientes`, `categorias/empleados`, `clientes`, `empleados`.

---

## 13. Paso 11 — Códigos de error de la API

### Formato de éxito

```json
{ "ok": true, "mensaje": "Registro creado correctamente",
  "datos": { }, "meta": { "total": 3, "pagina": 1, "limite": 20 } }
```

### Formato de error

```json
{ "ok": false,
  "error": { "codigo": "CONFLICTO",
             "mensaje": "Ya existe un rol llamado \"administrador\"",
             "detalles": null } }
```

### Códigos

| Código HTTP | `error.codigo` | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | Datos inválidos (detalle campo a campo en `detalles`) |
| 400 | `CUERPO_INVALIDO` | Cuerpo vacío, JSON roto o sin campos actualizables |
| 400 | `LLAVE_FORANEA` | Se referenció un `id` que no existe |
| 404 | `NO_ENCONTRADO` | El recurso no existe |
| 404 | `RUTA_NO_ENCONTRADA` | Ninguna ruta coincidió con la petición |
| 409 | `CONFLICTO` | Registro duplicado, registro con hijos, rol sin permisos |
| 409 | `LLAVE_FORANEA` | No se puede borrar: otros registros dependen de él |
| 500 | `INTERNO` | Falla imprevista (el detalle solo va al log, nunca al cliente) |
| 500 | `BASE_DE_DATOS` | MySQL apagado o credenciales incorrectas |

### Traducción MySQL → HTTP

| Error de MySQL | HTTP |
|---|---|
| `ER_DUP_ENTRY` | 409 |
| `ER_NO_REFERENCED_ROW` | 400 |
| `ER_ROW_IS_REFERENCED` | 409 |
| `ER_DATA_TOO_LONG` | 400 |
| `ER_BAD_NULL_ERROR` | 400 |
| `ECONNREFUSED` / `ER_ACCESS_DENIED_ERROR` | 500 |
| `SyntaxError` de `express.json()` | 400 |

---

## 14. Estructura final del proyecto

```
discoteca-api/
├── .gitignore                     nuevo
├── .env.example                   nuevo
├── README.md                      nuevo (este archivo)
├── package.json                   nuevo
├── package-lock.json              lo genera npm install
├── node_modules/                  lo genera npm install (ignorado por git)
├── database/                      ya existía (esquema y seeds)
├── docs/                          ya existía (postman, plan)
└── src/
    ├── .env                       ya existía (no se modificó)
    ├── index.js                   ya existía (no se modificó)
    ├── config/
    │   ├── env.js                 nuevo
    │   ├── database.js            nuevo
    │   └── express.js             nuevo
    ├── controllers/
    │   ├── salud.controller.js    nuevo
    │   ├── rol.controller.js      nuevo
    │   ├── permiso.controller.js  nuevo
    │   └── usuario.controller.js  nuevo
    ├── middleware/
    │   ├── logger.js              nuevo
    │   ├── errorHandler.js        nuevo
    │   └── validarParametros.js   nuevo
    ├── models/                    ya existía (26 clases, NO se modificó)
    ├── routes/
    │   ├── index.js               nuevo
    │   ├── salud.routes.js        nuevo
    │   ├── rol.routes.js          nuevo
    │   ├── permiso.routes.js      nuevo
    │   └── usuario.routes.js      nuevo
    ├── services/
    │   ├── rol.service.js         nuevo
    │   ├── permiso.service.js     nuevo
    │   └── usuario.service.js     nuevo
    └── utils/
        ├── constants.js           nuevo
        ├── AppError.js            nuevo
        ├── respuesta.js           nuevo
        ├── mensajes.js            nuevo
        ├── formato.js             nuevo
        ├── fechas.js              nuevo
        ├── validadores.js         nuevo
        └── cifrado.js             nuevo
```

### Comandos rápidos

```bash
npm install                 # instalar dependencias
npm run dev                 # arrancar con recarga
npm start                   # arrancar una sola vez
curl http://localhost:3000/api/salud   # verificar
```
