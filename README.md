# API REST — DISCOTECA (Evidencia 2)

> **Ficha 3489088 · Proyecto Discoteca · Backend Node.js + Express + MySQL**
> Versión entregable: tag `v1.0-evidencia2`.

API REST que digitaliza la operación diaria de una discoteca: control de acceso
por QR, reservas con detección de conflicto, compras con transacción de stock,
eventos con ficha técnica, ventas con IVA y comprobante, programa de puntos y
reportes de desempeño.

---

## 1. Requisitos previos

### Software que hay que instalar en el computador

| Software | Versión | Cómo verificarlo (terminal) | Observación |
|---|---|---|---|
| **Node.js** | 18 o superior (probado con Node 24) | `node --version` y `npm --version` | **npm viene incluido con Node.js**: no se instala "npm" por separado. |
| **MySQL Server** | 8 | `mysql --version` | Al instalar se define la clave del usuario `root`. Debe quedar corriendo en `localhost:3306`. |
| **Git** (opcional) | cualquiera | `git --version` | Solo si quieres usar **Git Bash** como terminal. |
| **Postman** (opcional) | cualquiera | — | Para importar la colección de pruebas (sección 8). |

Comprobar que MySQL esté corriendo (**Terminal de Windows**, como
administrador; el servicio suele llamarse `MySQL80`):

```powershell
net start MySQL80
```

### Terminales usadas en esta guía

| Etiqueta de la guía | Cómo abrir | Características |
|---|---|---|
| **Terminal de Windows** | `Windows + X` → *Terminal* (PowerShell) o *Símbolo del sistema* (CMD) | Comandos de Windows: `cd`, `copy`, `dir` |
| **Git Bash** | Menú inicio → *Git Bash* (se instala junto con Git) | Comandos estilo Linux: `cp`, `ls`, y la redirección `<` de archivos |

> Los scripts de `npm` (`npm install`, `npm start`, `npm test`, `npm run
> db:*`) funcionan **igual en las dos terminales**. La diferencia está en los
> comandos de Windows/Linux y en la redirección `<` de los archivos `.sql`
> (ver paso 2.5).

### Dependencias npm del proyecto

No hay que instalar paquetes npm a mano ni con `-g` (globales). Todas las
librerías que usa la API (`express`, `mysql2`, `dotenv`, `cors`, `bcryptjs`,
`jsonwebtoken`, `qrcode`) están declaradas en `package.json` y se instalan
automáticamente en el paso 2.2 con `npm install`.

## 2. Puesta en marcha (paso a paso)

> **Antes que nada:** todos los comandos de `npm` se ejecutan **dentro de la
> carpeta `discoteca-api`** (la que contiene `package.json`). Si te aparece
> el error `ENOENT: ... package.json`, es que estás parado en la carpeta
> equivocada.

### 2.1 Entrar a la carpeta del proyecto

**Terminal de Windows (PowerShell o CMD):**

```powershell
cd "C:\Users\TU_USUARIO\Desktop\TRABAJO-FINAL-SENA\Backend-proyecto discoteca\discoteca-api"
dir
```

**Git Bash:**

```bash
cd "/c/Users/TU_USUARIO/Desktop/TRABAJO-FINAL-SENA/Backend-proyecto discoteca/discoteca-api"
ls
```

En la lista deben aparecer `package.json`, `src`, `database` y
`.env.example`.

### 2.2 Instalar las dependencias del proyecto

**Terminal de Windows o Git Bash (mismo comando):**

```bash
npm install
```

Esto lee `package.json` y crea la carpeta `node_modules/`. Solo se ejecuta
una vez (o cuando cambian las dependencias).

### 2.3 Crear el archivo de configuración `.env`

**Terminal de Windows (PowerShell o CMD):**

```powershell
copy .env.example .env
```

**Git Bash:**

```bash
cp .env.example .env
```

Si MySQL y el proyecto usan los valores por defecto, **no hace falta editar
nada**; opcionalmente cambia `JWT_SECRETO` por un texto propio. Importante:
el `.env` guarda el usuario de la **APLICACIÓN** (`discoteca_app`), nunca
`root` ni el administrador creado en el paso 2.4.

### 2.4 Crear la base de datos y un usuario administrador en MySQL

1. Abrir una terminal y entrar a MySQL con `root` (la clave que definiste
   al instalar MySQL):

**Terminal de Windows o Git Bash (mismo comando):**

```bash
mysql -u root -p
```

2. Dentro de la consola de MySQL, crear la base de datos del proyecto y un
   usuario con permisos de administrador:

```sql
-- Base de datos del proyecto
CREATE DATABASE IF NOT EXISTS discoteca_api
  CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;

-- Usuario con permisos de ADMINISTRADOR.
-- Los privilegios sobre *.* (globales) son necesarios para que pueda
-- correr los scripts de la carpeta database/: crear la base, las tablas
-- y el usuario de aplicación (CREATE USER / GRANT).
CREATE USER IF NOT EXISTS 'discoteca_admin'@'localhost'
  IDENTIFIED BY 'DiscotecaAdmin2026';

GRANT ALL PRIVILEGES ON *.*
  TO 'discoteca_admin'@'localhost'
  WITH GRANT OPTION;

FLUSH PRIVILEGES;

-- Verificación
SHOW GRANTS FOR 'discoteca_admin'@'localhost';
EXIT;
```

> Si prefieres, puedes saltarte este usuario y usar `root` directamente en
> los pasos siguientes: `root` también tiene permisos de administrador.

### 2.5 Cargar tablas, usuario de aplicación y datos de prueba

Los archivos `.sql` están en la carpeta `database/`. **La redirección `<`
NO funciona en PowerShell**, así que estos comandos se ejecutan en **Git
Bash** (o en CMD si usas Windows):

**Git Bash (o Terminal CMD):**

```bash
# 1) Crea las 26 tablas de la base discoteca_api
mysql -u discoteca_admin -p < database/01_schema.sql

# 2) Crea el usuario de mínimo privilegio que usa la API (discoteca_app)
mysql -u discoteca_admin -p < database/02_usuario_app.sql

# 3) Datos de prueba: roles, usuarios, clientes, productos, eventos, etc.
mysql -u discoteca_admin -p discoteca_api < database/03_seed.sql
```

Cada comando pide la contraseña del administrador
(`DiscotecaAdmin2026`).

**Alternativa con `root` desde cualquier terminal** (los scripts de npm ya
traen los comandos anteriores escritos):

```bash
npm run db:schema   # mysql -u root -p < database/01_schema.sql
npm run db:user     # mysql -u root -p < database/02_usuario_app.sql
npm run db:seed     # mysql -u root -p discoteca_api < database/03_seed.sql
```

> Si la terminal responde `mysql no se reconoce`, añade la carpeta `bin` de
> MySQL al **PATH** o escribe la ruta completa del ejecutable, por ejemplo:
> `"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u discoteca_admin -p < database/01_schema.sql`

### 2.6 Arrancar el servidor

**Terminal de Windows o Git Bash (mismo comando):**

```bash
npm start
```

(O `npm run dev` para que el servidor se reinicie solo al guardar cambios.)

Salud del servidor: `GET http://localhost:3000/api/salud`
(abrirla en el navegador o en Postman).

### Credenciales del seed

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@correo.mx` | `Admin1234` |
| Empleado | `empleado@correo.mx` | `Empleado1234` |
| Cliente | `cliente@correo.mx` | `Cliente1234` |

> En `NODE_ENV=development`, `POST /api/auth/recuperar-password` devuelve el
> código de verificación en la respuesta para poder encadenar el restablecer
> en Postman o en pruebas.

## 3. Variables de entorno (`.env`)

| Variable | Descripción |
|---|---|
| `PUERTO` | Puerto del servidor (3000) |
| `DB_HOST`, `DB_PUERTO`, `DB_USUARIO`, `DB_CLAVE`, `DB_NOMBRE` | Conexión MySQL (usuario `discoteca_app` creado por `02_usuario_app.sql`) |
| `DB_LIMITE_CONEXIONES` | Tamaño del pool (10) |
| `ORIGENES_PERMITIDOS` | CORS: orígenes del frontend separados por coma |
| `JWT_SECRETO`, `JWT_EXPIRACION` | Firma y vigencia del token (2h) |
| `AFORO_MAXIMO` | Aforo del local (200): alerta al 90 %, bloqueo al 100 % |
| `IVA_PORCENTAJE` | IVA de las ventas (16 %) |

`.env` está en `.gitignore`; `.env.example` es la plantilla pública.

## 4. Arquitectura (capas)

```
src/
├── index.js              arranque (carga env, conecta, escucha)
├── config/               env.js · database.js (pool) · express.js
├── utils/                constants · AppError · respuesta · formato · fechas
│                         mensajes · validadores (ColectorErrores) · cifrado · tokens
├── middleware/           errorHandler (capturarAsync) · autenticacion · autorizacion
│                         bitacora · validarParametros · logger
├── models/               entidades con POO (#privados, toJSON, fábricas desdeFila)
├── repositories/         SQL parametrizado + transacciones (sin lógica de negocio)
├── services/             reglas de negocio (valida → normaliza → persiste)
├── controllers/          HTTP: lee req, llama al service, responde con respuesta.js
└── routes/               un archivo por módulo, montado en config/express.js
```

**Patrones aplicados:** Singleton (pool), `capturarAsync` (manejo de errores),
`ColectorErrores` + `lanzarSiHay` (validación con `detalles[]` por campo),
POST → `201` + `Location`, `PATCH /:id/estado`, composición en detalles
(compras, reservas, ventas, fichas) y N:M roles↔permisos / ficha↔servicios.

## 5. Contrato de respuestas (C4)

Éxito:

```json
{ "ok": true, "mensaje": "...", "datos": {}, "meta": {} }
```

Error:

```json
{ "ok": false, "error": { "codigo": "E-409", "mensaje": "...", "detalles": [] } }
```

Códigos: `E-400` validación (con `detalles[{campo,mensaje}]`), `E-401` sin
token, `E-403` sin permiso, `E-404` no existe, `E-409` conflicto de reglas,
`E-500` inesperado (el mensaje técnico no se expone).

## 6. Módulos y endpoints (resumen)

| Módulo | Prefijo | Contenido |
|---|---|---|
| Salud | `GET /api/salud` | Liveness del servidor |
| Permisos | `/api/permisos` | CRUD del catálogo de permisos |
| Roles | `/api/roles` | CRUD + `GET/POST /:id/permisos` + `DELETE /:id/permisos/:idPermiso` (mínimo 1 permiso) |
| Usuarios | `/api/usuarios` | CRUD + `PATCH /:id/estado` |
| Auth | `/api/auth` | `login`, `logout`, `registro`, `GET/PUT mi-perfil`, `recuperar-password`, `restablecer-password` |
| Proveedores | `/api/proveedores` | CRUD + estado (RFC único) |
| Productos | `/api/productos` | CRUD + estado (stock mínimo/máximo) |
| Servicios | `/api/servicios` | CRUD + estado |
| Categorías | `/api/categorias-empleados`, `/api/categorias-clientes` | CRUD + estado |
| Empleados | `/api/empleados` | CRUD + estado (NSS único, categoría activa) |
| Clientes | `/api/clientes` | CRUD + estado (RFC único, `esVip`) |
| Compras | `/api/compras` | CRUD + `/:id/confirmar` (suma stock) + `/:id/cancelar` |
| Inventario | `/api/inventario/alertas` | Productos bajo el stock mínimo |
| Agenda empleados | `/api/agenda` | Turnos empleado+servicio+fecha |
| Reservas | `/api/reservas` | CRUD + `/:id/estado` + `/:id/qr` (conflicto de espacio/horario → 409) |
| Ingresos | `/api/ingresos` | `POST /validar` (QR), `GET /aforo`, historial |
| Eventos | `/api/eventos` | CRUD + `/:id/estado` + `/:id/ficha` (técnica 1:1 con servicios N:N) |
| Agenda eventos | `/api/agenda-eventos` | Tareas por evento + estado |
| Ventas | `/api/ventas` | CRUD + `/:id/estado` + `/:id/pagar` (IVA, comprobante, puntos) + `/:id/anular` |
| Puntos | `/api/puntos/:idCliente` | Saldo y `POST /canjear` (máx. 50 % del acumulado) |
| Reportes | `/api/reportes` | `top-clientes`, `servicios-solicitados`, `productos-menos-vendidos`, `ventas-por-mes`, `ventas-mayor-menor`, `ventas-subtotales`, `comparativo-eventos` |
| Bitácora | `/api/bitacora` | Historial de creación/edición/anulación (admin) |

La matriz completa RF → endpoint → fase → evidencia está en
**`docs/TRAZABILIDAD.md`** (93 RF del SRS + 8 RNF + 3 RN).

## 7. Pruebas

```bash
# Suite unitaria (node --test): utils, AppError y modelos — sin BD ni red
npm test

# Prueba global E2E: recorre la colección Postman COMPLETA contra el servidor
# (requiere el servidor corriendo: npm start en otra terminal)
npm run test:e2e
```

Último resultado verificado:

| Prueba | Resultado |
|---|---|
| `npm test` | 33 pruebas, 0 fallos |
| `npm run test:e2e` | 135 peticiones, 213 afirmaciones, 0 fallos |

La E2E usa un runner propio con shim mínimo de `pm.*` (sin dependencias
externas), porque replica la semántica de la colección Postman sin necesidad
de Newman.

## 8. Colección Postman (C9)

Archivo: **`docs/postman/Discoteca.postman_collection.json`** (133 peticiones).

1. Importar el archivo en Postman (o usar la colección compartida).
2. La variable global `base_url` apunta a `http://localhost:3000`.
3. Ejecutar en orden la carpeta `01 Login y salud` primero: captura `{{token}}`
   y las variables de ids (`usuarioLogueadoId`, `clienteCarlosId`, etc.).
4. El resto de carpetas encadena los flujos: catálogos → compras → reservas →
   ingresos → eventos → ventas → reportes → cierre (logout).

## 9. Base de datos

26 tablas en el esquema `discoteca_api` (`database/01_schema.sql`), con:

- `roles ↔ permisos` (N:M con PK compuesta), `usuarios → accesos`.
- `evento → ficha_tecnica` (1:1) y `ficha_tecnica ↔ servicios` (N:N).
- `categoria_empleado → empleados → agenda_empleados`.
- `clientes ↔ categoria_clientes`, `ventas ↔ productos`, `compras ↔ productos`
  con sus tablas de detalle (composición).
- `reservas` con restricción única `uq_reserva_espacio_horario` (RN-02).
- `bitacora` poblada por el middleware de trazabilidad.

`database/03_seed.sql` crea datos coherentes con la colección Postman y los
diagramas UML (`docs/uml/`).

## 10. Decisiones y alcance honesto

- **Notificaciones simuladas** (RF-EVE-10/11, RF-VEN-15): se persisten en la
  tabla `notificaciones` y se registran en log; no hay proveedor de correo/SMS
  (TBD-02 del SRS).
- **VIP** (RN-01): modelado como `esVip` en clientes + espacios de tipo VIP en
  reservas; sin precio diferencial (alcance del backend de la Evidencia 2).
- **Puntos** (RN-03): 1 punto por cada $10 pagados; canje máximo del 50 % del
  acumulado, con doble guarda en el `UPDATE` (saldo ≥ 0 y tope 50 %).
- **Aforo** (RNF-SAF-01): `AFORO_MAXIMO` desde `.env`; alerta al 90 % y
  bloqueo al 100 %.
- **TLS (RNF-SEG-01)** y disponibilidad (RNF-CAL-01) dependen del despliegue,
  no de este repositorio.

## 11. Estructura del repositorio

```
discoteca-api/
├── database/            01_schema.sql · 02_usuario_app.sql · 03_seed.sql · CAMBIOS.md
├── docs/
│   ├── postman/         Discoteca.postman_collection.json (133 requests)
│   ├── scrum/           sprint-planning.md · tablero.md · cierre-sprint.md
│   ├── uml/             diagramas de objetos (.drawio + .png)
│   └── TRAZABILIDAD.md  matriz RF → endpoint → fase → evidencia
├── src/                 código fuente por capas (ver sección 4)
├── tests/               suite node --test + runner E2E de la colección
├── .env.example         plantilla de variables de entorno
└── package.json         scripts: start · dev · test · test:e2e · db:*
```

## 12. Licencia

Proyecto formativo SENA — ficha 3489088. Licencia MIT.
