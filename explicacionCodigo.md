# Explicación del código, paso a paso

> Documento complementario de `README.md` (cómo se armó) y `PRUEBAS.md` (cómo se
> prueba en Postman). Aquí se explica **qué hace cada carpeta, cada archivo y
> cómo lo hace**, siguiendo el recorrido real de una petición.

---

## Índice

1. [La arquitectura en una imagen](#1-la-arquitectura-en-una-imagen)
2. [El viaje de una petición](#2-el-viaje-de-una-petición)
3. [Archivos de la raíz](#3-archivos-de-la-raíz)
4. [`database/` — el SQL](#4-database--el-sql)
5. [`src/index.js` — el arranque](#5-srcindexjs--el-arranque)
6. [`src/config/` — configuración](#6-srcconfig--configuración)
7. [`src/utils/` — utilidades](#7-srcutils--utilidades)
8. [`src/middleware/` — filtros de la cadena](#8-srcmiddleware--filtros-de-la-cadena)
9. [`src/models/` — las entidades](#9-srcmodels--las-entidades)
10. [`src/services/` — las reglas de negocio](#10-srcservices--las-reglas-de-negocio)
11. [`src/controllers/` — la capa HTTP](#11-srccontrollers--la-capa-http)
12. [`src/routes/` — el contrato de URLs](#12-srcroutes--el-contrato-de-urls)
13. [Recorrido completo: `GET /api/roles/7`](#13-recorrido-completo-get-apiroles7)
14. [Contrato de respuesta y códigos](#14-contrato-de-respuesta-y-códigos)
15. [Tabla de endpoints y sus capas](#15-tabla-de-endpoints-y-sus-capas)
16. [Recetas: “si quiero… entonces…”](#16-recetas-si-quiero-entonces)
17. [Glosario](#17-glosario)

---

## 1. La arquitectura en una imagen

El proyecto está dividido en **capas**. Cada capa habla SOLO con la de abajo y
nunca se salta a otra:

```
        Cliente (Postman / frontend)
                 |
                 v
   ┌─────────────────────────────┐
   │  routes/     ¿qué URL y     │  "tabla de contenido" de la API
   │              qué verbo?"    │  + middlewares de formato
   └──────────────┬──────────────┘
                  v
   ┌─────────────────────────────┐
   │  controllers/ ¿qué respuesta │  arma el JSON y el codigo HTTP
   │              HTTP envio?"    │  (try/catch -> next(error))
   └──────────────┬──────────────┘
                  v
   ┌─────────────────────────────┐
   │  services/    ¿que reglas    │  validaciones, unicidad, transacciones
   │              aplico?"        │  LANZA AppError si algo falla
   └──────────────┬──────────────┘
                  v
   ┌─────────────────────────────┐
   │  models/      ¿que forma     │  objeto Rol/Permiso/Usuario
   │              tiene el dato?" │  atributos privados + toJSON()
   └──────────────┬──────────────┘
                  v
   ┌─────────────────────────────┐
   │  config/database.js         │  pool de MySQL, SQL parametrizado
   └──────────────┬──────────────┘
                  v
               MySQL
```

### Qué hace (y qué NO) cada capa

| Capa | SÍ hace | NO hace |
|---|---|---|
| `routes/` | declarar verbo + URL + middlewares de formato | reglas de negocio, SQL |
| `controllers/` | leer `req`, llamar al service, armar la respuesta | SQL, `if` de negocio, cálculos |
| `services/` | validar, verificar unicidad, transaccionar, lanzar errores | tocar `res`, conocer HTTP |
| `models/` | guardar datos, normalizar, serializar (`toJSON`) | saber SQL o Express |
| `config/database.js` | ejecutar SQL parametrizado | decidir reglas de negocio |
| `utils/` | funciones puras compartidas (mensajes, fechas, errores) | estado de la aplicación |
| `middleware/` | mirar/transformar la petición y la respuesta | lógica de una entidad concreta |

**Regla de reconocimiento:** si en un controlador aparece un `SELECT` o un
`if (total > 0)`, esa lógica está en la capa equivocada; si en un model
aparece `req` o `res`, también.

---

## 2. El viaje de una petición

Tomemos `GET /api/roles/7`:

1. **`src/config/express.js`** recibe la petición en el orden registrado:
   `CORS → express.json() → logger → rutas`.
2. **`src/routes/index.js`** monta `/api` y redirige a `/roles`.
3. **`src/routes/rol.routes.js`** encuentra `router.get('/:id', ...)`.
4. El middleware **`validarIdNumerico('id')`** comprueba que `"7"` sea un entero
   positivo y lo deja convertido en `req.idsValidados.id`. Si fuera `abc`,
   responde **400** sin tocar MySQL.
5. **`src/controllers/rol.controller.js`** ejecuta `obtener` dentro de su
   `try/catch` y llama a `rolService.obtenerPorId(7)`.
6. **`src/services/rol.service.js`** arma el SQL con `?` (parametrizado),
   consulta el rol y luego sus permisos; si no existe, hace
   `throw AppError.noEncontrado(...)`.
7. **`src/config/database.js`** ejecuta la consulta con el pool.
8. El service convierte cada fila en un objeto con `Rol.desdeFila()` y
   `Permiso.desdeFila()`.
9. El controlador entrega el objeto a **`utils/respuesta.js`**, que responde
   `200 { ok: true, mensaje, datos, meta }`.
10. **`middleware/logger.js`** imprime en consola `GET /api/roles/7 200 3.2 ms`.

Si algo falla en el paso 6, el `catch` del controlador hace `next(error)` y el
camino termina en **`middleware/errorHandler.js`**, que traduce el error a
código HTTP + mensaje y responde en nombre de todos.

---

## 3. Archivos de la raíz

| Archivo / carpeta | Para qué sirve |
|---|---|
| `README.md` | Guía de instalación y construcción (14 secciones). |
| `PRUEBAS.md` | Las 22 peticiones + 11 casos negativos para probar a mano en Postman: URL, método y JSON listos para pegar. |
| `explicacionCodigo.md` | Este documento. |
| `package.json` | Dependencias y scripts. |
| `.env.example` | Plantilla de variables de entorno (se copia a `src/.env`). |
| `.gitignore` | Excluye `node_modules/`, `src/.env`, logs. |
| `database/` | Esquema, usuario de aplicación y datos de ejemplo (SQL). |
| `docs/` | Trazabilidad, scrum y cambios. |
| `src/` | Todo el código de la API. |
| `node_modules/` | Dependencias instaladas (no se sube a git). |

### `package.json`

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "node --watch src/index.js"
}
```

- `npm start` → arranca una vez.
- `npm run dev` → arranca y **reinicia solo** cada vez que guardas un archivo
  (`--watch`), cómodo mientras programás.
- Las dependencias son: `express` (web), `cors` (permisos del navegador),
  `mysql2` (cliente MySQL), `dotenv` (variables `.env`) y `bcryptjs` (hash de
  contraseñas).

---

## 4. `database/` — el SQL

| Archivo | Qué hace |
|---|---|
| `01_schema.sql` | Crea la base `discoteca_api` con **27 tablas**, sus llaves foráneas, índices únicos y las columnas `ENUM`. |
| `02_usuario_app.sql` | Crea el usuario MySQL `discoteca_app` con **mínimo privilegio** (solo `SELECT, INSERT, UPDATE, DELETE`). |
| `03_seed.sql` | Vacía las tablas y carga los datos de ejemplo (roles, 19 permisos, usuarios con clave hasheada). |
| `CAMBIOS.md` | Bitácora de decisiones técnicas de la base. |

### Lo que hay que recordar de `01_schema.sql`

- **`roles`**: `id_rol` (PK autoincremental), `nombre_rol` (único), `descripcion`,
  `estado ENUM('activo','inactivo')`, `fecha_creacion`.
- **`permisos`**: misma estructura, con `nombre_permiso` único.
- **`rol_permiso`**: tabla **puente** de la relación N:M; su llave es la pareja
  `(id_rol, id_permiso)` y ambas columnas tienen `ON DELETE CASCADE` (al borrar
  el rol, MySQL borra sus asignaciones solo).
- **`usuarios`**: `id_rol` es NOT NULL y **no** tiene cascada: por eso borrar un
  rol con usuarios da **409** (el middleware traduce `ER_ROW_IS_REFERENCED`).

### `02_usuario_app.sql` — por qué no se conecta como `root`

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON discoteca_api.* TO 'discoteca_app'@'localhost';
```

La aplicación **no** puede crear ni borrar tablas. Si alguien logra inyectar
SQL, el daño queda limitado a filas, no al esquema.

### `03_seed.sql` — datos fijos para las pruebas

1. Primero **vacía** todas las tablas (con `FOREIGN_KEY_CHECKS = 0`) y luego
   inserta, así que se puede re-ejecutar cuantas veces haga falta.
2. Los `id` **no** están fijos: los asigna `AUTO_INCREMENT`, por eso en Postman
   se capturan de cada respuesta (`datos.id`).
3. Credenciales embebidas con hash bcrypt: `admin@correo.mx / Admin1234`
   (rol administrador, 19 permisos), `empleado@correo.mx / Empleado1234`,
   `cliente@correo.mx / Cliente1234`.
4. Estado actual de la semilla: roles `5 administrador`, `6 cliente`,
   `7 empleado`; permisos `23…41` (19); 10 usuarios.

---

---

## 5. `src/index.js` — el arranque

Es el **punto de entrada** y solo se ocupa del ciclo de vida (118 líneas):

1. **Carga la configuración primero** (`require('./config/env')`). Si falta una
   variable obligatoria, `env.js` detiene el proceso ahí mismo (*fail fast*).
2. **Verifica MySQL** con `await db.verificarConexion()`. Si no responde, imprime
   `BASE_DE_DATOS_NO_DISPONIBLE` y hace `process.exit(1)`: no tiene sentido
   escuchar peticiones sin base de datos.
3. **Arma y enciende la app**: `crearAplicacion()` (que solo construye) y
   `app.listen(puerto)` (que abre el puerto). Se guarda el servidor devuelto.
4. **Apagado elegante** con `SIGINT` (Ctrl+C) y `SIGTERM`:
   `servidor.close()` (deja de aceptar conexiones) → `db.cerrar()` (cierra el
   pool) → `process.exit(0)`, con una alarma de 10 segundos por si algo se
   cuelga.
5. **Diagnóstico final**: `unhandledRejection` y `uncaughtException` se registran
   en el log; los segundos además detienen el proceso porque el estado ya no es
   confiable.

Aquí NO hay lógica de negocio: si este archivo crece demasiado, algo no
pertenece ahí.

---

## 6. `src/config/` — configuración

### 6.1 `env.js` — variables de entorno validadas

- Ejecuta `require('dotenv').config()` **una sola vez**, apuntando a `src/.env`
  (un nivel arriba de `config/`). El resto de la app importa este módulo en vez
  de leer `process.env` por todos lados.
- Expone cuatro lectoras:
  - `obligatoria(nombre)` → si falta, escribe en **stderr** y termina el
    proceso con código 1.
  - `opcional(nombre, defecto)` → devuelve el valor o el defecto.
  - `entera(nombre, defecto)` → convierte `"3000"` (texto) en `3000` (número);
    `process.env` **siempre** devuelve texto.
  - `lista(nombre, defecto)` → `"a.com, b.com"` → `['a.com', 'b.com']`.
- Exporta un objeto `Object.freeze(...)`: ya no se puede modificar después del
  arranque. Incluye `baseDatos` (host, puerto, usuario, clave, nombre,
  `limiteConexiones`) y los getters `esDesarrollo` / `esProduccion`.

### 6.2 `database.js` — la única puerta a MySQL

Es una clase con **un solo export: la instancia** (`module.exports = new
Database()`), así todos los `require()` comparten el mismo pool (patrón
singleton; Node cachea los módulos).

| Método | Qué hace |
|---|---|
| `get pool` | Crea el pool **la primera vez** que se necesita (inicialización perezosa). |
| `verificarConexion()` | Toma una conexión, hace `ping()` y la devuelve en un `finally` (si se olvida el `release()`, el pool se vacía y la app se congela). |
| `ejecutar(sql, parametros)` | Ejecuta con `?` y devuelve las filas. |
| `obtenerUno(sql, parametros)` | Igual, pero devuelve la primera fila o `null`. |
| `conTransaccion(trabajo)` | `beginTransaction` → corre `trabajo(conexion)` → `commit`; si algo falla, `rollback` y relanza el error; en `finally` devuelve la conexión. |
| `cerrar()` | Cierra el pool (se llama al apagar el servidor). |

**Seguridad:** jamás se concatena texto del cliente en el SQL.

```js
// MAL (inyección SQL): 'SELECT * FROM roles WHERE id_rol = ' + id
// BIEN:
await db.ejecutar('SELECT * FROM roles WHERE id_rol = ?', [id]);
```

Con `?`, MySQL recibe el valor como **dato** y nunca como código. Además
`pool.execute()` usa *prepared statements*, que se compilan una vez y se
reutilizan.

Opciones del pool: `utf8mb4` (acentos, ñ, emojis), `timezone: 'local'` (debe
coincidir con `utils/fechas.js` para que una fecha de las 22:00 no se corra) y
`decimalNumbers: false` (el dinero llega como texto, sin perder decimales).

### 6.3 `express.js` — arma la aplicación

Separa **crear** de **escuchar** (por eso se puede importar la app en pruebas
sin ocupar el puerto). El orden de los `app.use()` es crítico, porque Express
ejecuta los middlewares en el orden en que se registran:

| # | Registro | Por qué va ahí |
|---|---|---|
| 1 | `app.disable('x-powered-by')` | no anunciar el framework. |
| 2 | `cors({ origin: origenesPermitidos, ... })` | autoriza el frontend de otro puerto; **no** se usa `origin: '*'`. `exposedHeaders: ['Location']` permite leer la cabecera `Location` del POST. |
| 3 | `express.json({ limit: '100kb' })` | convierte el cuerpo JSON en `req.body`; sin él, `req.body` sería `undefined`. |
| 4 | `registrarPeticion` | el logger necesita el cuerpo ya parseado para imprimirlo. |
| 5 | `app.use('/api', rutas)` | monta todo el enrutador bajo `/api`. |
| 6 | `app.get('/')` | saludo orientativo en la raíz. |
| 7 | `app.use(rutaNoEncontrada)` | si llegamos aquí, ninguna ruta coincidió → 404. |
| 8 | `app.use(manejadorErrores)` | **siempre el último** y con **4 parámetros** (`err, req, res, next`); con 3, Express lo trata como middleware normal y nunca se activa. |

---

## 7. `src/utils/` — utilidades

Son funciones/clases **sin estado**: se importan desde cualquier capa.

### 7.1 `constants.js` — la única fuente de verdad de los valores

- `ESTADO = { ACTIVO: 'activo', INACTIVO: 'inactivo' }` y los enums por entidad
  (`ESTADO_RESERVA`, `TIPO_EVENTO`, `METODO_PAGO`…).
- `LIMITES`: largos de columna (`NOMBRE_ROL: 50`…), paginación
  (`LIMITE_DEFECTO: 20`, `LIMITE_PAGINA: 100`) y contraseña
  (`CONTRASENA_MIN: 8`, `CONTRASENA_MAX: 72` — bcrypt no procesa más de 72
  bytes).
- `SEGURIDAD`: `BCRYPT_ROUNDS: 12` y `MINIMO_PERMISOS_ROL: 1`.
- `HTTP` (códigos) y `CODIGO_ERROR` (`'NO_ENCONTRADO'`, `'CONFLICTO'`…): el
  nombre técnico que viaja en `error.codigo` para que el frontend pueda hacer
  `switch` sin interpretar textos en español.
- Todo con `Object.freeze`: `ESTADO.ACTIVO = 'x'` no hace nada. Si acá dice
  `'activo'` y en MySQL el `ENUM` dice lo mismo, la consulta funciona; si
  difieren, el INSERT revienta.

### 7.2 `mensajes.js` — todos los textos en un solo lugar

Cuatro grupos congelados:

- `EXITO` → “Registro creado correctamente”, “Permiso asignado al rol
  correctamente”…
- `VALIDACION` → `CAMPO_REQUERIDO(campo)`, `CAMPO_DEMASIADO_LARGO(campo, max)`
  (algunos son **funciones** porque interpolan datos).
- `NEGOCIO` → `ROL_NO_EXISTE(id)`, `ROL_DUPLICADO(nombre)`,
  `ROL_SIN_PERMISOS`, `PERMISO_YA_ASIGNADO`, `CORREO_DUPLICADO(email)`…
- `SISTEMA` → `RUTA_NO_ENCONTRADA(metodo, url)`, `JSON_MAL_FORMADO`,
  `VARIABLE_ENTORNO_FALTANTE(nombre)`…

Ventaja: una typo se corrige en un solo archivo y dos endpoints que hacen lo
mismo responden **el mismo texto**.

### 7.3 `AppError.js` — el error con forma de respuesta

```js
class AppError extends Error {          // HERENCIA: sigue siendo un Error
  #status; #codigo; #detalles;          // ENCAPSULAMIENTO real con #
  get status() / get codigo() / get detalles()
  aJSON() -> { ok:false, error:{ codigo, mensaje, detalles } }
}
```

Además tiene **fábricas estáticas** (polimorfismo): quien llama no recuerda
números mágicos, solo la intención.

| Fábrica | Código | Cuándo |
|---|---|---|
| `AppError.validacion(msg, detalles)` | 400 | datos mal formados |
| `AppError.cuerpoInvalido(msg)` | 400 | JSON inválido o cuerpo vacío |
| `AppError.noEncontrado(msg)` | 404 | el recurso no existe |
| `AppError.conflicto(msg)` | 409 | duplicado, hijo pendiente, rol sin permisos |
| `AppError.rutaNoEncontrada(msg)` | 404 | ninguna ruta coincidió |
| `AppError.baseDatos(msg)` | 500 | MySQL no responde / credenciales mal |
| `AppError.interno(msg)` | 500 | bug inesperado (mensaje genérico al cliente) |
| `AppError.noAutenticado` / `sinPermiso` | 401 / 403 | reservados para la fase JWT |

### 7.4 `respuesta.js` — el “sobre” de la respuesta

- `exito(res, { estado=200, mensaje, datos, meta })` →
  `{ ok: true, mensaje, datos, meta }`. `datos` va **siempre** (aunque `null`)
  para que el cliente pueda hacer `datos.map(...)` sin preguntar.
- `creado(res, …)` → igual pero con **201**.
- `error(res, { estado, codigo, mensaje, detalles })` →
  `{ ok:false, error:{ codigo, mensaje } }`; `detalles` solo si no está vacío.
  Normalmente lo llama el manejador de errores, no los controladores.
- `construirMeta({ total, pagina, limite, devueltos })` →
  `totalPaginas`, `hayPaginaSiguiente`, `hayPaginaAnterior`.

### 7.5 `formato.js` — normaliza, no rechaza

| Función | Ejemplo |
|---|---|
| `limpiarTexto` | `"  Maria   Jose  "` → `"Maria Jose"` |
| `aTituloPropio` | `"juan carlos"` → `"Juan Carlos"` (solo nombres) |
| `aEnteroONulo` | `"12.7"` → `12`, `"abc"` → `null` |
| `aBanderaEntera` | `"si"`, `"1"`, `"true"` → `true` |
| `soloCamposPermitidos(origen, permitidas)` | **defensa**: si el cliente manda `{"id_rol": 99}`, simplemente se ignora; solo pasan las llaves de la lista |
| `estaVacio` | `null`, `""`, `[]` → `true` |
| `normalizarPaginacion` | `?pagina=abc` → 1; `?limite=9999` → 100 (tope duro); devuelve `desplazamiento` para el `OFFSET` |

`normalizarPaginacion` también es seguridad: `req.query` llega como texto y lo
escribe cualquiera; meterlo sin acotar a `LIMIT ${limite}` sería una inyección.

### 7.6 `fechas.js` — un solo formato de fecha

Regla de la API: **hacia adentro** (MySQL) se manda un `Date` de JavaScript;
**hacia afuera** (JSON) siempre texto ISO 8601.

- `aDate(valor)` → casi cualquier cosa a `Date`; devuelve `null` si no se puede
  interpretar (protege contra `new Date('basura')`).
- `aFechaHoraISO` → `"2026-10-24T21:30:00.000Z"`.
- `aFechaISO` → `"YYYY-MM-DD"` armado con la fecha **local** (si se hiciera con
  `toISOString().slice(0,10)`, una 23:00 en Bogotá podría devolver el día
  siguiente).
- `aFechaMySQL`, `esFechaPasada`, `esFechaFutura`, `calcularEdad` (calcula con
  mes y día, no dividiendo por 365) y `ahoraISO()`.

### 7.7 `validadores.js` — `ColectorErrores`

Clase que **acumula** errores y lanza **una sola vez** al final:

```js
const errores = new ColectorErrores();
errores.exigirTexto('nombreRol', datos.nombreRol, { maximo: 50 });
errores.exigirCorreo('email', datos.email);
errores.exigirValorDeLista('estado', datos.estado, ['activo', 'inactivo']);
errores.lanzarSiHayErrores();   // -> AppError.validacion con TODOS los detalles
```

Si cada validación lanzara de inmediato, el cliente recibiría un error cada vez
y reenviaría la petición cinco veces; aquí recibe los cinco de una vez, campo
por campo.

Métodos: `exigirTexto`, `exigirCorreo`, `exigirContrasena` (8+ caracteres, al
menos una letra y un número), `exigirEntero` (con `minimo`/`maximo`),
`exigirId` (entero ≥ 1), `exigirFecha` (`futura`/`pasada`),
`exigirValorDeLista` (el validador natural de los `ENUM` de MySQL).

### 7.8 `cifrado.js` — contraseñas

- `hashearPassword(clave)` → `"$2b$12$..."` (60 caracteres) con
  `bcryptjs` y 12 *rounds* (~250 ms a propósito: bcrypt es lento para que la
  fuerza bruta no salga rentable). Se usa `bcryptjs` (JavaScript puro) y no
  `bcrypt` (compila C con node-gyp y suele fallar en Windows).
- `verificarPassword(clave, hash)` → única forma correcta de comparar; devuelve
  `false` si el hash no es texto (no deja que bcrypt explote con `null`).
- `esHashBcrypt(valor)` → detecta dobles hashes en migraciones.

**Nunca** se guarda, se loguea ni se devuelve una contraseña en claro: solo su
hash, y `Usuario.toJSON()` ni siquiera lo serializa.

---

## 8. `src/middleware/` — filtros de la cadena

Un middleware es una función `(req, res, next)` que Express ejecuta en cadena:

```
petición -> [cors] -> [json] -> [logger] -> [rutas] -> [404] -> [errores] -> respuesta
```

Si un middleware no llama a `next()` ni responde, la petición queda colgada
para siempre (el error más común al empezar con Express).

### 8.1 `logger.js` — registro de peticiones y eventos

- `registrar(nivel, codigo, datos)` imprime
  `[2026-10-24T21:30:00.000Z] INFO  SERVIDOR_INICIADO {"puerto":3000}`; los
  datos van en JSON para que una búsqueda por texto encuentre todas las líneas
  de un evento. Atajos: `registrarInfo`, `registrarAviso`, `registrarError`.
- Colores ANSI: 2xx verde, 4xx amarillo, 5xx rojo (funciones
  `colorPorEstado`/`colorPorNivel`).
- `registrarPeticion` es el middleware: mide el tiempo con
  `process.hrtime.bigint()` y escucha el evento `finish` de `res` (el único
  momento en que se conoce el código de estado final). Imprime
  `GET  /api/roles/7  200  3.2 ms`.
- En desarrollo imprime también el cuerpo, pero **enmascara `contrasena` con
  `***`**: los logs se pegan en correos y foros.
- Exporta `COLOR` (lo reutiliza `errorHandler.js`).

### 8.2 `errorHandler.js` — el único que responde errores

Tres exportaciones:

1. **`traducirErrorMySQL(error)`** — convierte códigos del driver en
   `AppError` entendibles:

   | MySQL | Respuesta |
   |---|---|
   | `ER_DUP_ENTRY` | 409 “El registro ya existe…” |
   | `ER_NO_REFERENCED_ROW(_2)` | 400 `LLAVE_FORANEA` |
   | `ER_ROW_IS_REFERENCED(_2)` | 409 `LLAVE_FORANEA` (borrar rol con usuarios) |
   | `ER_DATA_TOO_LONG`, `ER_BAD_NULL_ERROR`, `ER_WRONG_VALUE_FOR_COLUMN` | 400 |
   | `ECONNREFUSED`, `PROTOCOL_CONNECTION_LOST` | 500 `BASE_DE_DATOS` |
   | `ER_ACCESS_DENIED_ERROR`, `ER_BAD_DB_ERROR` | 500 (credenciales del `.env`) |

2. **`rutaNoEncontrada(req, res, next)`** — 404 “No existe el recurso GET
   /api/no/existe”; hace `next(error)` para saltar al manejador (si se llamara
   a `next()` sin argumento, seguiría la cadena normal).

3. **`manejadorErrores(err, req, res, next)`** — tres pasos:
   1. **Normaliza**: si ya es `AppError` se usa tal cual; si es `SyntaxError`
      con `body` → `CUERPO_INVALIDO` (cliente que olvidó `Content-Type`); si
      viene de MySQL → `traducirErrorMySQL`; si no, `INTERNO` con mensaje
      **genérico** (no se filtran detalles internos al cliente).
   2. **Registra**: 5xx con stack completo en rojo; 4xx solo una línea amarilla
      en desarrollo.
   3. **Responde** con `respuesta.error(...)`.

> **Nota:** los controladores NO usan ningún envoltorio: cada método tiene su
> propio `try/catch` y hace `next(error)` (ver sección 11).

### 8.3 `validarParametros.js` — validación de formato, antes de MySQL

- **`validarIdNumerico('id')`** es una **fábrica** (cierra sobre el nombre del
  parámetro): devuelve un middleware que comprueba `req.params.id` con
  `esEnteroPositivo` (acepta `"7"`, rechaza `"7.5"`, `"-1"`, `"abc"`,
  `"1e5"`). Si falla → `AppError.validacion` vía `next(...)`; si pasa, deja el
  número convertido en `req.idsValidados.id`, que es lo que leen los
  controladores.
- **`exigirCuerpo`** rechaza cuerpos vacíos, `null`, arreglos o `{}` → 400
  `CUERPO_INVALIDO`. Se usa en `POST`/`PUT`.

Se aplica el principio *fail fast*: `GET /api/roles/abc` se rechaza en 400 sin
abrir una conexión a MySQL.

---

## 9. `src/models/` — las entidades

### 9.1 `index.js` (archivo barril)

Reexporta los **26 modelos** desde un solo punto, para que un service escriba
una línea en vez de veintiséis:

```js
const { Rol, Permiso } = require('../models');
```

Funciona porque se llama `index.js` (convención de Node para el archivo
principal de una carpeta). Es el único archivo que cambia al sumar una entidad.

### 9.2 El patrón, explicado con `Rol.js`

Un model es una clase que representa una fila como objeto de JavaScript. **No
sabe SQL ni HTTP.**

- **Atributos privados con `#`** (`#id`, `#nombreRol`, `#estado`, `#permisos`,
  `#totalPermisos`): `#` es sintaxis real del lenguaje; intentar leerlo desde
  afuera lanza `SyntaxError`. El guion bajo (`_`) es solo convención.
- **Getters/setters** como lugar de normalización: el `setter` de `nombreRol`
  recorta espacios, porque `"  admin  "` y `"admin"` serían dos filas distintas
  en una columna UNIQUE.
- **`get permisos()` devuelve una copia** (`[...this.#permisos]`): si devolviera
  la referencia, alguien podría hacer `rol.permisos.push(basura)` sin pasar por
  `agregarPermiso()`.
- **`get totalPermisos()`** resuelve un caso práctico: en el **listado** los
  permisos no se cargan (sería una consulta por rol), así que devuelve el
  conteo que trajo la subconsulta; en el **detalle** devuelve
  `this.#permisos.length`. Quien lo usa no necesita saber de dónde viene.
- **Comportamiento de dominio**: `estaActivo()`, `activar()`, `desactivar()`,
  `agregarPermiso()` (no duplica), `quitarPermiso()`,
  `tienePermiso(nombre)` (se usará en la autorización futura),
  `estaSinPermisos()`.
- **Fábricas estáticas**:
  - `Rol.desdeFila(fila)` — traduce `snake_case` → `camelCase`
    (`nombre_rol` → `nombreRol`). Es el **único** lugar donde conviven los dos
    estilos, y también lee `total_permisos` cuando viene de la subconsulta.
  - `Rol.desdeJSON(datos)` — construye desde `req.body` ya normalizado.
    Es la fábrica que usa `rol.service.crear()` (y también
    `permiso.service.crear()` y `usuario.service.crear()` con sus
    modelos) justo antes de persistir.
- **`aFilaBaseDatos()`** devuelve el formato de columna para INSERT/UPDATE, sin
  `id` (autoincremental) ni `fecha_creacion` (es `DEFAULT CURRENT_TIMESTAMP` y
  en un UPDATE **no** debe cambiar).
- **`toJSON()`** es el que define qué ve el cliente. `JSON.stringify()` lo llama
  automáticamente, de modo que el controlador puede hacer `res.json(rol)` y los
  atributos privados se publican **de forma controlada**:

  ```js
  { id, nombreRol, descripcion, estado, activo, fechaCreacion,
    totalPermisos, permisos: [ ...serializados en cascada ] }
  ```

  En `Usuario.js`, `toJSON()` **no** incluye `contrasenaHash`: esa es la
  garantía de que la contraseña jamás sale por la API.

Los otros 25 modelos (`Permiso`, `Usuario`, `Cliente`, `Producto`, `Venta`,
`Reserva`, `Evento`…) siguen exactamente el mismo patrón.

---

## 10. `src/services/` — las reglas de negocio

Es la capa con más lógica: valida, garantiza unicidad, usa transacciones y
**lanza `AppError`** cuando algo falla. Nunca toca `res` ni sabe qué es HTTP.

### Qué devuelve cada método (contrato, igual que el ejemplo)

Los tres services (`rol`, `permiso`, `usuario`) devuelven **exactamente lo
mismo que devolvería el `persona-api` del profesor**:

| Método | Qué devuelve |
|---|---|
| `listar` | `{ roles|permisos|usuarios, total, pagina, limite }` |
| `obtenerPorId` | la **instancia** del modelo (o 404 si no existe) |
| `crear` | la **instancia construida** con `id = insertId` y su `fechaCreacion`; **no se re-lee la fila** |
| `actualizar` | `return this.obtenerPorId(id)`, la fila **releída** al final |
| `cambiarEstado` | la **misma instancia en memoria** con el estado ya cambiado (tras `activar()`/`desactivar()`); no se re-lee |
| `eliminar` | un resumen plano `{ id, … }` **sin** campo `mensaje` |

El `POST` de usuario es el único que cambió de aspecto respecto a una
relectura: como la instancia recién creada no pasa por el `INNER JOIN`,
la respuesta **no trae `nombreRol`** (todos los `GET` sí lo traen).

### 10.1 `rol.service.js`

Arriba declara tres constantes que evitan repetir SQL:

```js
const COLUMNAS_ROL = 'r.id_rol, r.nombre_rol, ...';
const CONTEO_PERMISOS = '(SELECT COUNT(*) FROM rol_permiso rp WHERE rp.id_rol = r.id_rol) AS total_permisos';
const SQL_PERMISOS_DEL_ROL = 'SELECT p.id_permiso, ... FROM rol_permiso rp INNER JOIN permisos p ... WHERE rp.id_rol = ?';
```

**¿Por qué una subconsulta y no un `JOIN` para contar?** Un JOIN multiplicaría
las filas: un rol con 10 permisos saldría 10 veces y habría que agrupar igual.
La subconsulta devuelve cada rol **una sola vez** con su conteo ya calculado y
evita el problema N+1.

| Método | Qué hace paso a paso |
|---|---|
| `listar(filtros)` | normaliza paginación → arma `WHERE` dinámico (solo si `estado` es un valor válido y `busqueda` no está vacío; el patrón `LIKE` escapa `%` y `_`) → `COUNT(*)` para el total → `SELECT … LIMIT/OFFSET` → mapea a `Rol.desdeFila`. |
| `obtenerPorId(id)` | trae el rol; si `null` → `throw AppError.noEncontrado(ROL_NO_EXISTE(id))`; luego carga los permisos en una segunda consulta y los agrega con `rol.agregarPermiso(...)`. |
| `crear(datos)` | `soloCamposPermitidos` → `#validar` (objeto plano) → `#asegurarNombreUnico` → `Rol.desdeJSON` → `fechaCreacion = fechas.ahoraISO()` → `aFilaBaseDatos()` → `INSERT` → `rol.id = insertId` → **devuelve la instancia creada sin re-leerla** (como el ejemplo). |
| `actualizar(id, datos)` | existe → filtra campos; si no vino **ninguno** → 400 “ningún campo actualizable”; completa lo que faltó con el valor existente, valida el conjunto completo y solo comprueba unicidad si el nombre **cambió** → aplica setters **solo de los campos que llegaron** → `UPDATE` **dinámico** (solo esas columnas, valores de `aFilaBaseDatos()`) → reconsulta con `obtenerPorId`, igual que el ejemplo. |
| `cambiarEstado(id, estado)` | existe → `exigirValorDeLista` con los valores de `ESTADO` → `rol.activar()` / `rol.desactivar()` → `UPDATE` solo de `estado` → **devuelve la misma instancia en memoria** (no se re-lee). |
| `eliminar(id)` | existe → `DELETE`; `rol_permiso` cae por `ON DELETE CASCADE`; si el rol tiene usuarios, MySQL responde `ER_ROW_IS_REFERENCED` → 409. Devuelve `{ id, nombreRol, permisosLiberados }` en lugar de 204, para que en las pruebas **se vea** qué se borró. |
| `asignarPermiso(idRol, idPermiso)` | valida que `idPermiso` sea entero ≥ 1 **antes** de abrir la transacción → `conTransaccion`: ¿existe el rol? ¿existe el permiso? ¿ya estaba asignado? (409 con mensaje propio en vez del `ER_DUP_ENTRY` genérico) → `INSERT` en la puente → fuera de la transacción, reconsulta el rol completo para devolver `totalPermisos` actualizado. **No mira el estado del rol**: un rol `inactivo` puede seguir recibiendo permisos. |
| `quitarPermiso(idRol, idPermiso)` | todo dentro de **una** transacción: rol existe → estaba asignado (si no, 404) → **cuenta** los permisos; si `total <= SEGURIDAD.MINIMO_PERMISOS_ROL` (1) → `throw AppError.conflicto(ROL_SIN_PERMISOS)` y no se toca nada → `DELETE` → relee los permisos restantes **dentro de la misma transacción** y los devuelve como arreglo. |
| `#validar(entrada)` (privado) | `ColectorErrores`: `nombreRol` requerido (≤ 50), `descripcion` opcional (≤ 255), `estado` solo si vino → `lanzarSiHayErrores()` → devuelve un **objeto plano** ya limpio; la instancia la construye `crear()` con `Rol.desdeJSON()` (validar y fabricar quedan separados, como en el ejemplo). |
| `#asegurarNombreUnico(nombre, idExcluido)` (privado) | busca el nombre en otra fila → 409 `ROL_DUPLICADO`. Es **comodidad, no seguridad**: la protección real la da el `UNIQUE` de la columna (y, en una carrera entre dos peticiones, el traductor de MySQL). `idExcluido ?? -1` permite usarlo también en el UPDATE. |

### 10.2 `permiso.service.js`

Mismo esqueleto que roles (los seis CRUD + `#validar` + `#asegurarNombreUnico`),
pero **sin** sub-recurso: los permisos no se asignan aquí, sino desde
`rol.service.asignarPermiso`. Campos permitidos: `nombrePermiso`,
`descripcion`, `estado`. El listado admite `estado` y `busqueda`.

Mismo tratamiento que en roles: `#validar` devuelve objeto plano, `crear`
construye el `Permiso` con `desdeJSON` y **devuelve la instancia con su id**
(la tabla no tiene `fecha_creacion`, así que no se setea nada más),
`actualizar` usa setters + `UPDATE` dinámico y relee al final, `cambiarEstado`
devuelve la instancia en memoria y `eliminar` devuelve
`{ id, nombrePermiso }`.

### 10.3 `usuario.service.js`

Diferencias importantes respecto a los otros dos:

- **Contraseña**: en `crear` hace
  `contrasenaHash = await cifrado.hashearPassword(...)` y la pasa ya
  hasheada a `Usuario.desdeJSON({ ..., contrasenaHash })` (la clave en
  claro jamás llega al modelo); el hash entra al `INSERT` salido de
  `aFilaBaseDatos()`. En `actualizar`, solo si vino una contraseña
  nueva, se setea `usuario.contrasenaHash` y el hash viaja **en el mismo
  `UPDATE` dinámico** (ya no hay un segundo `UPDATE` aparte). Nunca se
  guarda ni se devuelve en claro.
- **`crear` devuelve la instancia** (con `id = insertId` y
  `fechaCreacion = fechas.ahoraISO()`), sin re-leer: como esa instancia
  no pasa por el `INNER JOIN`, la respuesta del `POST /api/usuarios` **no
  trae `nombreRol`**; todos los `GET`, el `PUT` y el `PATCH` sí lo traen.
- **`eliminar`** devuelve `{ id, nombreCompleto, email }` (mismo estilo
  que el ejemplo: llave `id`, sin `mensaje`) y responde
  `USUARIO_EN_USO` si el usuario tiene historial (accesos, bitácora), en
  lugar de dejar que la FK reviente.
- **Validación condicional**: `#validar(entrada, { esCreacion, traeContrasena })`
  exige contraseña solo en la creación (o cuando se envía una nueva) y aplica
  la regla *8+ caracteres, letra y número*.
- **`#asegurarRolExistente(idRol)`**: consulta `roles` antes de insertar; si no
  existe → 400 `ROL_INVALIDO` (además, la FK de MySQL también lo impediría).
- **`#asegurarCorreoUnico(email, idExcluido)`** → 409 `CORREO_DUPLICADO`.
- **Consultas con `INNER JOIN roles`**: como `id_rol` es NOT NULL, el JOIN
  nunca pierde filas y el listado puede mostrar el nombre del rol y filtrar por
  `?idRol=5`.

---

## 11. `src/controllers/` — la capa HTTP

Un controlador delgado: saca datos de `req`, delega en el service y arma la
respuesta. **Cada método tiene su `try/catch` propio:**

```js
crear = async (req, res, next) => {
  try {
    const rol = await rolService.crear(req.body);

    res.set('Location', `/api/roles/${rol.id}`);

    return respuesta.creado(res, {
      mensaje: MENSAJES.EXITO.RECURSO_CREADO,
      datos: rol
    });
  } catch (error) {
    next(error);          // -> middleware/errorHandler.js
  }
};
```

Sin ese `catch`, Express no atrapa los errores de una función `async` y la
petición quedaría colgada. Con él, **todos** los errores (del service, de MySQL,
inesperados) terminan en el mismo lugar, que decide código HTTP, mensaje y log.

Convenciones que se repiten en los tres controladores:

- Los ids salen de `req.idsValidados` (ya convertidos y validados por el
  middleware), no de `parseInt` manual.
- `GET` listado → `respuesta.exito` + `meta` de paginación.
- `POST` → `res.set('Location', '/api/…/' + id)` y `respuesta.creado` (**201**).
- `PATCH /:id/estado` → lee **solo** `req.body.estado`.
- `DELETE` → `respuesta.exito` con un resumen (**200**, no 204).

---

## 12. `src/routes/` — el contrato de URLs

### 12.1 `index.js` (enrutador principal)

- `GET /api` → documento de **descubrimiento**: lista los recursos disponibles
  (`/api/roles`, `/api/permisos`, `/api/usuarios`, `/api/salud`). Una API bien
  hecha se describe a sí misma.
- `router.use('/roles', rolRoutes)` → la URL final es la suma de prefijos:

  ```
  app.use('/api', rutas)              -> /api
    router.use('/roles', rolRoutes)   -> /api/roles
      router.get('/:id', ...)         -> /api/roles/:id
  ```

### 12.2 `rol.routes.js` — el orden importa

```js
router.get('/',      rolController.listar);
router.post('/',     exigirCuerpo, rolController.crear);

// El sub-recurso va ANTES de '/:id'
router.post('/:id/permisos',  validarIdNumerico('id'), exigirCuerpo, rolController.asignarPermiso);
router.delete('/:id/permisos/:idPermiso', validarIdNumerico('id'), validarIdNumerico('idPermiso'), rolController.quitarPermiso);

router.get('/:id',    validarIdNumerico('id'), rolController.obtener);
router.put('/:id',    validarIdNumerico('id'), exigirCuerpo, rolController.actualizar);
router.patch('/:id/estado', validarIdNumerico('id'), exigirCuerpo, rolController.cambiarEstado);
router.delete('/:id', validarIdNumerico('id'), rolController.eliminar);
```

Express evalúa **de arriba hacia abajo** y se detiene en la primera coincidencia:
si `/:id` estuviera antes, `GET /api/roles/5/permisos` sería atrapado con
`id = "5/permisos"`.

También es la **tabla de contenido** de la entidad: en 20 segundos se ve todo lo
que se puede hacer con los roles. Ninguna ruta tiene autenticación todavía (el
JWT llegará en una fase posterior).

`permiso.routes.js` y `usuario.routes.js` son iguales, con sus seis rutas CRUD.

---

## 13. Recorrido completo: `GET /api/roles/7`

Paso a paso, desde la terminal hasta el JSON de vuelta:

1. **Postman** envía `GET http://localhost:3000/api/roles/7`.
2. **`config/express.js`** aplica, en este orden:
   - `cors()` → comprueba el origen contra `ORIGENES_PERMITIDOS`;
   - `express.json()` → no hay cuerpo en un GET, no hace nada;
   - `registrarPeticion` → toma la hora de inicio (`hrtime.bigint()`).
3. **`routes/index.js`** recorta `/api` y pasa el resto (`/roles/7`) al
   router de roles.
4. **`routes/rol.routes.js`** recorre las rutas de arriba hacia abajo: `/`
   no coincide, `POST /` no coincide (método distinto), `/:id/permisos` tampoco;
   coincide `router.get('/:id')` con `id = "7"`.
5. **`middleware/validarParametros.js`** → `esEnteroPositivo("7")` es `true`,
   así que deja `req.idsValidados.id = 7` (número, no texto) y llama a `next()`.
   Si la URL fuera `/api/roles/abc`, aquí terminaría con **400**
   `PARAMETRO_INVALIDO` y ni siquiera se tocaría MySQL.
6. **`controllers/rol.controller.js` → `obtener`**: abre su `try`, lee
   `req.idsValidados.id` y llama a `rolService.obtenerPorId(7)`.
7. **`services/rol.service.js` → `obtenerPorId`** consulta:

   ```sql
   SELECT r.id_rol, r.nombre_rol, r.descripcion, r.estado, r.fecha_creacion,
          (SELECT COUNT(*) FROM rol_permiso rp WHERE rp.id_rol = r.id_rol) AS total_permisos
     FROM roles r WHERE r.id_rol = ?     -- parametro: [7]
   ```

8. **`config/database.js` → `ejecutar`** toma una conexión del pool y corre
   `pool.execute(sql, [7])` (consulta parametrizada).
9. Si la fila llega **vacía**, el service lanza
   `AppError.noEncontrado('No existe el rol con id 7')`; el `catch` del
   controlador hace `next(error)` y **`middleware/errorHandler.js`** responde
   `404 { ok:false, error:{ codigo:'NO_ENCONTRADO', … } }`.
10. Si la fila **existe**, se construye `Rol.desdeFila(fila)` (traduce
    `nombre_rol` → `nombreRol`) y se corre la segunda consulta,
    `SQL_PERMISOS_DEL_ROL`, para cargar la relación N:M.
11. Cada fila de permiso se convierte con `Permiso.desdeFila()` y entra con
    `rol.agregarPermiso(...)`.
12. El controlador recibe el `Rol` y llama a `respuesta.exito(res, …)`, que
    serializa con `JSON.stringify(rol)` → el `toJSON()` decide qué campos salen.
13. Llega la respuesta:

    ```json
    {
      "ok": true,
      "mensaje": "Registro encontrado",
      "datos": {
        "id": 7, "nombreRol": "empleado", "descripcion": "Operacion del dia a dia del local",
        "estado": "activo", "activo": true, "fechaCreacion": "2026-10-17T22:30:01.000Z",
        "totalPermisos": 9, "permisos": [ { "id": 23, "nombrePermiso": "…" }, … ]
      }
    }
    ```

14. **`middleware/logger.js`** escucha el evento `finish` de `res` e imprime
    `GET   /api/roles/7  200  3.2 ms`.

---

## 14. Contrato de respuesta y códigos

**Éxito (200 / 201):**

```json
{ "ok": true, "mensaje": "…", "datos": { … } , "meta": { … } }
```

`datos` va **siempre** (aunque `null`); `meta` solo en listados paginados
(`total`, `pagina`, `limite`, `devueltos`, `totalPaginas`, `hayPaginaSiguiente`,
`hayPaginaAnterior`).

**Error (400 / 404 / 409 / 500):**

```json
{ "ok": false, "error": { "codigo": "NO_ENCONTRADO", "mensaje": "…", "detalles": [ … ] } }
```

`detalles` solo aparece cuando aporta información (validación campo a campo).

| Código HTTP | `error.codigo` | Cuándo en esta API |
|---|---|---|
| 200 | — | lectura, actualización, eliminación con resumen |
| 201 | — | `POST` que crea (más cabecera `Location`) |
| 400 | `VALIDACION` | datos inválidos (contraseña débil, id no numérico) |
| 400 | `CUERPO_INVALIDO` | cuerpo vacío o JSON mal formado |
| 400 | `LLAVE_FORANEA` | `idRol` inexistente al crear usuario |
| 404 | `NO_ENCONTRADO` | rol/permiso/usuario inexistente |
| 404 | `RUTA_NO_ENCONTRADA` | URL que no existe (`POST /api/no/existe`) |
| 409 | `CONFLICTO` | nombre duplicado, permiso repetido, rol sin permisos |
| 409 | `LLAVE_FORANEA` | `DELETE /api/roles/5` con usuarios asignados |
| 500 | `BASE_DE_DATOS` / `INTERNO` | MySQL caído, bug inesperado |

---

## 15. Tabla de endpoints y sus capas

| # | Método y ruta | Controller | Service | Modelo |
|---|---|---|---|---|
| 1 | `GET /api/salud` | `salud.verificar` | — (usa `db.verificarConexion`) | — |
| 2 | `GET /api/permisos` | `permiso.listar` | `permisoService.listar` | `Permiso` |
| 3 | `GET /api/permisos/:id` | `permiso.obtener` | `permisoService.obtenerPorId` | `Permiso` |
| 4 | `POST /api/permisos` | `permiso.crear` | `permisoService.crear` | `Permiso` |
| 5 | `PUT /api/permisos/:id` | `permiso.actualizar` | `permisoService.actualizar` | `Permiso` |
| 6 | `PATCH /api/permisos/:id/estado` | `permiso.cambiarEstado` | `permisoService.cambiarEstado` | `Permiso` |
| 7 | `DELETE /api/permisos/:id` | `permiso.eliminar` | `permisoService.eliminar` | `Permiso` |
| 8 | `GET /api/roles` | `rol.listar` | `rolService.listar` | `Rol` |
| 9 | `GET /api/roles/:id` | `rol.obtener` | `rolService.obtenerPorId` | `Rol` + `Permiso` |
| 10 | `POST /api/roles` | `rol.crear` | `rolService.crear` | `Rol` |
| 11 | `PUT /api/roles/:id` | `rol.actualizar` | `rolService.actualizar` | `Rol` |
| 12 | `PATCH /api/roles/:id/estado` | `rol.cambiarEstado` | `rolService.cambiarEstado` | `Rol` |
| 13 | `DELETE /api/roles/:id` | `rol.eliminar` | `rolService.eliminar` | `Rol` |
| 14 | `POST /api/roles/:id/permisos` | `rol.asignarPermiso` | `rolService.asignarPermiso` (transacción) | `Rol` + `Permiso` |
| 15 | `DELETE /api/roles/:id/permisos/:idPermiso` | `rol.quitarPermiso` | `rolService.quitarPermiso` (transacción) | `Rol` + `Permiso` |
| 16 | `GET /api/usuarios` | `usuario.listar` | `usuarioService.listar` | `Usuario` |
| 17 | `GET /api/usuarios/:id` | `usuario.obtener` | `usuarioService.obtenerPorId` | `Usuario` |
| 18 | `POST /api/usuarios` | `usuario.crear` | `usuarioService.crear` (hashea) | `Usuario` |
| 19 | `PUT /api/usuarios/:id` | `usuario.actualizar` | `usuarioService.actualizar` | `Usuario` |
| 20 | `PATCH /api/usuarios/:id/estado` | `usuario.cambiarEstado` | `usuarioService.cambiarEstado` | `Usuario` |
| 21 | `DELETE /api/usuarios/:id` | `usuario.eliminar` | `usuarioService.eliminar` | `Usuario` |
| 22 | `GET /api` (descubrimiento) | ruta anónima en `routes/index.js` | — | — |

Esos 22 son exactamente los requests numerados en `PRUEBAS.md` (6 de permisos,
10 de roles —incluyen asignar/quitar permisos— y 6 de usuarios), más los
casos negativos N1…N11.

---

## 16. Recetas: “si quiero… entonces…”

### 16.1 Agregar una entidad nueva (ej. `productos`)

1. **`database/01_schema.sql`** → definir la tabla con sus FK y `ENUM`.
2. **`database/03_seed.sql`** → agregar el `DELETE FROM productos;` y sus
   `INSERT` de ejemplo.
3. **`src/models/Producto.js`** → copiar el patrón de `Rol.js` (privados,
   getters/setters, `desdeFila`, `desdeJSON`, `aFilaBaseDatos`, `toJSON`).
4. **`src/models/index.js`** → agregar `Producto` al *barrel*.
5. **`src/services/producto.service.js`** → los seis métodos + `#validar` +
   `#asegurarNombreUnico`.
6. **`src/controllers/producto.controller.js`** → seis métodos con
   `try/catch` + `next(error)`.
7. **`src/routes/producto.routes.js`** → las seis rutas con sus middlewares.
8. **`src/routes/index.js`** → `router.use('/productos', productoRoutes)`.
9. **`utils/constants.js`** → si la tabla tiene enums propios, agregarlos ahí.
10. **`README.md` / `PRUEBAS.md`** → documentar y probar.

### 16.2 Agregar un filtro de listado

En el service, dentro del bloque que arma el `WHERE`:

```js
if (filtros.idRol) {
  condiciones.push('u.id_rol = ?');
  parametros.push(Number(filtros.idRol));
}
```

El patrón siempre es: **condición** (texto fijo) + **parámetro** (valor del
cliente). Nunca concatenar el valor en el SQL.

### 16.3 Cambiar un mensaje de la API

Editar **una sola vez** `src/utils/mensajes.js` (`EXITO`, `VALIDACION`,
`NEGOCIO` o `SISTEMA`). No hace falta tocar services ni controladores.

### 16.4 Agregar un código de error

1. `utils/constants.js` → `CODIGO_ERROR.NUEVO = 'NUEVO'`.
2. `utils/AppError.js` → fábrica estática `static nuevo(mensaje)`.
3. Lanzarlo desde el service: `throw AppError.nuevo('…')`.
4. `middleware/errorHandler.js` → solo si hay que traducir un error de MySQL
   nuevo.

### 16.5 Ver qué llega y qué sale

Mirar la consola: `middleware/logger.js` imprime cada petición con método, URL,
estado, duración y (en desarrollo) el cuerpo, con `contrasena` enmascarada. Los
eventos de arranque y los errores usan `registrar` / `registrarError`.

---

## 17. Glosario

| Término | Significado |
|---|---|
| **Middleware** | Función `(req, res, next)` que Express ejecuta en cadena. |
| **Capa / capas** | Separación `routes → controllers → services → models → DB`. |
| **Pool** | Conjunto de conexiones abiertas que se prestan y se recogen. |
| **Singleton** | Módulo que exporta una única instancia (`config/database.js`). |
| **Consulta parametrizada** | SQL con `?`; el valor viaja separado del código (evita inyección). |
| **Transacción** | Bloque “todo o nada”: `commit` o `rollback`. |
| **Fail fast** | Fallar lo antes posible y lo más cerca del dato malo. |
| **Tabla puente** | Tabla que resuelve una relación N:M (`rol_permiso`). |
| **`ON DELETE CASCADE`** | Al borrar el padre, MySQL borra las filas hijas. |
| **Baja lógica** | Cambiar `estado` a `inactivo` en vez de borrar la fila. |
| **`snake_case` / `camelCase`** | `nombre_rol` (MySQL) vs `nombreRol` (JS); el puente es `desdeFila()`. |
| **Envelope / sobre** | Formato único de la respuesta: `ok`, `mensaje`, `datos`, `meta`. |
| **Hash con sal** | Huella irreversible de la contraseña (bcrypt, 12 rounds). |
| **`toJSON()`** | Método que define qué expone un objeto al serializarse. |
| **N+1** | Consultar una vez por cada fila de un listado (se evita con la subconsulta). |
| **Graceful shutdown** | Apagar el servidor dejando terminar lo que está en curso. |
| **Fail fast (config)** | Detener el proceso al arrancar si falta una variable obligatoria. |

---

*Documento vivo: si el código cambia, actualizar también `README.md`
(qué se hizo) y `PRUEBAS.md` (cómo se prueba).*

