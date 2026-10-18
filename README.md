# API REST — DISCOTECA (Evidencia 2)

> **Ficha 3489088 · Proyecto Discoteca · Backend Node.js + Express + MySQL**
> Versión entregable: tag `v1.0-evidencia2`.

API REST que digitaliza la operación diaria de una discoteca: control de acceso
por QR, reservas con detección de conflicto, compras con transacción de stock,
eventos con ficha técnica, ventas con IVA y comprobante, programa de puntos y
reportes de desempeño.

---

## 1. Requisitos previos

- **Node.js 18+** (probado con Node 24) — fetch nativo y `node --test`.
- **MySQL 8** corriendo en `localhost:3306`.
- Un cliente para la colección Postman (Postman o Newman).

## 2. Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Entorno: copiar la plantilla y revisar los valores
cp .env.example .env

# 3. Base de datos (crea tablas y usuario de aplicación de mínimo privilegio)
npm run db:schema
npm run db:user

# 4. Datos de prueba (usuarios, roles, clientes, productos, eventos, etc.)
npm run db:seed

# 5. Arrancar el servidor (puerto 3000 por defecto)
npm start
```

Salud del servidor: `GET http://localhost:3000/api/salud`.

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
