# 🎶 API REST — DISCOTECA (Evidencia 2)

> **Ficha 3489088 · Proyecto Discoteca · Backend Node.js + Express + MySQL**
> Este README es **autocontenido**: cualquier persona (o modelo de IA) puede entender
> el negocio, la base de datos, la arquitectura y continuar el proyecto leyendo solo este archivo.

---

## 1. CONTEXTO DEL NEGOCIO

Una discoteca necesita **digitalizar su operación diaria**. Hoy pierde dinero y control por:

1. **Filas en la entrada** — el personal no sabe quién tiene reserva.
2. **Falta de control de existencias** — el bar no sabe qué se vende y qué se queda.
3. **Cobros lentos y sin trazabilidad** — no se sabe quién vendió qué, ni a qué hora.
4. **Falta de datos para decidir** — no hay reportes de ventas, servicios o eventos.

Esta API resuelve esos cuatro problemas mediante **8 subprocesos**: Configuración,
Usuarios/Acceso, Compras, Ingreso/VIP, Servicios/Reservas, Eventos, Ventas y Medición.

---

## 2. REGLAS DE ORO DEL PROYECTO

### Reglas de trabajo (solo chat, no se guardan en el repo)
Ejecutar **por fases**, **solo la fase que se indique**, **explicar antes de escribir código**,
**comentarios en español** y **preguntar cualquier duda**.

### Reglas de estilo (extraídas del ejemplo del profesor)

| Regla | Descripción |
|---|---|
| **R-ASYNC** | Todo acceso a BD con **`async/await`** sobre promesas. `Promise.all` para paralelo. `try/finally` para liberar conexiones. **Prohibido** callbacks `(err, result)`. |
| **R-DRY** | **Crear utilidades en `src/utils/` para no repetir código.** Si algo se usa en 2+ lugares, va a utils. |
| **R-CLEAN** | **Clean Code**: el código se entiende **sin leer los comentarios**. Nombres de variables, funciones, clases y métodos describen qué hacen. Todo en **español descriptivo**. |
| **R-COMENTARIO** | Los comentarios explican **por qué**, no **qué** hace la línea. |

**Nombres en español descriptivo (R-CLEAN):**
- Clases: `Venta`, `DetalleVenta`, `CompraRepository`.
- Métodos CRUD: `listar()`, `obtenerPorId()`, `crear()`, `actualizar()`, `eliminar()`.
- Métodos de negocio: `confirmar()`, `calcularTotal()`, `aplicarDescuento()`, `descontarStock()`, `generarCodigoQr()`, `verificarAforo()`.
- Siglas del dominio cuando aclaran: **QR, VIP, SAF (aforo), IVA, RFC, NSS**.

### Reglas de POO (P1–P6) — obligatorias en todo el código

| Regla | Requisito | Ejemplo |
|---|---|---|
| **P1** | Atributos **privados con `#`**, acceso por `get`/`set` | `#id`, `#estado` |
| **P2** | **Herencia** donde aporte | `AppError extends Error`; base `Detalle` |
| **P3** | **Agregación** (objeto con vida propia) | `Reserva` → `Cliente` |
| **P4** | **Composición** (`ON DELETE CASCADE`) | `Compra` → `DetalleCompra` |
| **P5** | **Encapsulamiento** (métodos, no asignación) | `usuario.desactivar()` |
| **P6** | **Polimorfismo** (`toJSON`, `desdeFila`, `desdeJSON`) | Cada clase |

### Reglas de negocio (RN)
| RN | Regla |
|---|---|
| RN-01 | Compra en estado **pendiente**; al **confirmar** suma stock, al **anular** no suma |
| RN-02 | No dos reservas **iguales** a la **misma hora** en el **mismo espacio** |
| RN-03 | Alerta cuando un producto baja del **stock mínimo** |
| RN-04 | Subtotal = cantidad × precio; descuento 10 % si ≥3 servicios; total = subtotal − descuento |
| RN-05 | **Un QR vigente** por reserva |
| RN-06 | **Aforo máximo**; alerta al **90 %**; bloqueo de reservas al **100 %** |
| RN-07 | Evento tiene **1 ficha técnica** (composición, cascada) |
| RN-08 | Agenda de eventos **sin solape** de horario/espacio → notificación simulada |
| RN-09 | Al **pagar** una venta: descuenta stock, genera comprobante y calcula total |
| RN-10 | Total = Σ(precio × cantidad) × **1.16 (IVA 16 %)** |
| RN-11 | Cliente gana **1 punto por cada $10**; canjea **50 %** en su siguiente compra |
| RN-12 | Notificaciones **simuladas** (se guardan en BD y se registran en consola) |

---

## 3. CÓMO CORRER EL PROYECTO

```bash
# 1. Requisitos: Node 20+, MySQL 8 corriendo
# 2. Copiar el archivo de entorno
copy .env.example .env
# 3. Editar .env con tus credenciales de MySQL
# 4. Instalar dependencias
npm install
# 5. Crear la base de datos (una sola vez)
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -proot < database\01_schema.sql
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -proot < database\02_usuario_app.sql
# 6. (Opcional) cargar datos de prueba
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -proot discoteca_api < database\03_seed.sql
# 7. Arrancar
npm run dev          # con recarga: node --watch src/index.js
```

**Probar que funciona:** abrir `http://localhost:3000/api/salud` → debe responder `{"ok":true,...}`.

---

## 4. BASE DE DATOS

Esquema activo: **`discoteca_api`** (copia exacta de `discoteca_db`, que se conserva **sin tocar** como respaldo).

**26 tablas** · 27 claves foráneas · 10 índices únicos · `utf8mb4_spanish_ci`

| Grupo | Tablas |
|---|---|
| Seguridad | `roles`, `permisos`, `rol_permiso`, `usuarios`, `accesos` |
| Clientes | `categoria_clientes`, `clientes`, `programa_puntos` |
| Servicios | `servicios`, `categoria_empleado`, `empleados`, `agenda_empleados` |
| Reservas | `reservas`, `detalle_reserva` |
| Ingreso | `ingresos` |
| Eventos | `evento`, `ficha_tecnica`, `ficha_servicio`, `agenda_eventos` |
| Inventario | `productos`, `proveedores`, `compras`, `detalle_compras` |
| Ventas | `ventas`, `detalle_ventas`, `notificaciones` |

> **Cambios vs la Evidencia 1** se documentan en **`database/CAMBIOS.md`** (obligatorio).
> El cambio principal previsto es la creación de la tabla **`bitacora`** (criterio C8).

---

## 5. ARQUITECTURA POR CAPAS (C3)

```
HTTP → routes → controllers → services → repositories → MySQL
                    │            │             │
                    └────────────┴─────────────┴──► models/ (dominio POO)
```

| Capa | Carpeta | Hace | NO hace |
|---|---|---|---|
| **Rutas** | `src/routes/` | Definir método + URL + middlewares | Lógica |
| **Controlador** | `src/controllers/` | Traducir HTTP ↔ servicio, elegir status | SQL ni reglas de negocio |
| **Servicio** | `src/services/` | **Reglas de negocio**, transacciones | SQL |
| **Repositorio** | `src/repositories/` | **SQL parametrizado** con `mysql2/promise` | Conocer Express |
| **Modelo** | `src/models/` | Objetos de dominio POO (P1–P6) | Conocer BD ni HTTP |

Capas transversales: `src/config/`, `src/middleware/`, `src/utils/`.

> **Sin ORM.** Se usa `mysql2/promise` con **pool** y **consultas parametrizadas**
> (`?` placeholders) para prevenir SQL injection.

> **Nota sobre `repositories`:** el ejemplo del profesor no tiene esta capa (el SQL vive
> en el service). La rúbrica la exige explícitamente, así que se usa. Si el profesor pide
> ser fiel a su ejemplo, se refactoriza extrayendo el SQL del service.

### Dónde va cada frase

| Si la frase empieza con… | Va en… |
|---|---|
| `SELECT` / `INSERT` / `UPDATE` / `DELETE` | `repository` |
| "si no existe", "si el stock baja", "si hay conflicto" | `service` |

### Patrones del ejemplo del profesor que se replican

1. **Singleton** — `module.exports = new Clase()` en database, services, controllers, repositories.
2. **`async/await` + `Promise.all` + `try/finally`** en todo acceso a BD.
3. **`capturarAsync`** en cada controlador → **cero `try/catch`** en controllers.
4. **`db.conTransaccion(async (conexion) => ...)`** usando `conexion.execute`.
5. **`ColectorErrores`** — valida todos los campos y lanza una sola vez.
6. **Listado paginado** + `WHERE` dinámico seguro + `LIMIT ? OFFSET ?`.
7. **Fábricas estáticas** `desdeFila()`/`desdeJSON()` + `aFilaBaseDatos()` + `toJSON()`.
8. **Setters que protegen el estado** (cambiar un dato recalcula otro).
9. **Controladores delgados** (3–8 líneas por método).
10. **`SELECT 1 AS existe`** para comprobar existencia.

---

## 6. CONTRATO DE LA API (C4)

**Respuesta exitosa:**
```json
{ "ok": true, "mensaje": "Rol creado", "datos": { }, "meta": { } }
```
**Respuesta de error:**
```json
{ "ok": false, "error": { "codigo": "E-409", "mensaje": "...", "detalles": [] } }
```

| Status | Cuándo |
|---|---|
| `200` | OK |
| `201` | Creado — con cabecera **`Location`** |
| `400` | Validación fallida |
| `401` | Sin JWT o inválido |
| `403` | JWT válido pero sin permiso |
| `404` | No encontrado |
| `409` | Conflicto (nombre duplicado, solape, QR ya usado) |
| `500` | Error interno (log + mensaje genérico) |

**Convenciones:** recursos en **plural minúscula** (`/api/roles`), sin verbos en la URL,
filtros por query (`?desde=...&pagina=1&limite=20&campos=...&q=...&orden=...&direccion=asc`).

---

## 7. SEGURIDAD (C7)

- **bcrypt** para hashear contraseñas (se usa `bcryptjs`, implementación JS del mismo algoritmo).
- **JWT** para mantener la sesión. El token se envía en `Authorization: Bearer <token>`.
- **Autorización por roles/permisos leídos de la BD**: el middleware `autorizacion.js`
  consulta `rol_permiso` → `permisos` en cada petición (no se guardan en el token).
- El **primer usuario** se crea con `database/02_usuario_app.sql`.

---

## 8. REQUISITOS NO FUNCIONALES (C8)

| RNF | Cómo se cumple |
|---|---|
| **Bitácora** | Tabla `bitacora` + middleware que registra cada alta/edición/baja |
| **Ley 1581** | Sección 10 de este README + endpoint `GET /api/acceso/mi-perfil` |
| **SAF (aforo)** | Aforo máximo, alerta al 90 %, bloqueo al 100 % |
| **Log de errores** | Formato `fecha · nivel · mensaje · detalle` en consola/archivo |

---

## 9. ESTRUCTURA DEL REPO

```
discoteca-api/
├── README.md                  ← este archivo
├── PLAN-TRABAJO.md            ← bitácora interna de trabajo
├── .gitignore                 ← excluye node_modules/ y .env
├── .env.example               ← plantilla SIN secretos
├── package.json
├── src/                       ← TODO el código
│   ├── index.js
│   ├── config/                env.js, database.js, express.js
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── repositories/          ← capa de datos
│   ├── models/
│   ├── middleware/
│   └── utils/
├── database/
│   ├── 01_schema.sql
│   ├── 02_usuario_app.sql
│   ├── 03_seed.sql
│   └── CAMBIOS.md             ← cambios vs Evidencia 1
└── docs/
    ├── TRAZABILIDAD.md        ← matriz RF → endpoint
    ├── postman/               ← colección de peticiones
    ├── uml/                   ← diagrama de objetos
    └── scrum/                 ← planning, tablero, cierre
```

---

## 10. DATOS PERSONALES — LEY 1581 (habeas data)

Esta API almacena datos personales de clientes y empleados (nombre, correo, teléfono, RFC/NSS).

- **Finalidad:** gestionar reservas, ventas, ingresos y fidelización de clientes.
- **Alcance:** solo los datos estrictamente necesarios para operar la discoteca.
- **Derechos del titular (art. 15):** conocer, actualizar, rectificar y suprimir sus datos.
- **Consulta:** cualquier titular puede ver sus datos en `GET /api/acceso/mi-perfil`.
- **Conservación:** los datos se mantienen mientras exista relación comercial.

---

## 11. ESTADO ACTUAL DEL PROYECTO

| Fase | Estado |
|---|---|
| 1 — Plan, README y copia de BD | ✅ Completada |
| 1b — `.gitignore`, `CAMBIOS.md`, estructura del repo | ✅ Completada |
| 2 — `package.json`, `.env.example`, dependencias | ✅ Completada |
| 3 en adelante | ⏳ Pendiente |

**Base de datos:** `discoteca_api` creada y verificada (26 tablas, sin `bitacora` aún — se crea en la Fase 10).
**Dependencias:** express 5.3.0, mysql2 3.24.5, cors 2.8.6, dotenv 18.0.7, bcryptjs 3.0.3, jsonwebtoken 9.0.3, qrcode 1.5.4.
**Siguiente paso:** ejecutar la **Fase 3** (`config/env.js`).

---

## 12. RUBRICA (resumen)

| C | Criterio | Pts | Dónde se ve |
|---|---|---|---|
| C1 | Cobertura RF + matriz | 22 | `docs/TRAZABILIDAD.md` |
| C2 | Diagrama de objetos UML | 10 | `docs/uml/` |
| C3 | Arquitectura por capas | 7 | `src/` |
| C4 | Diseño API REST | 8 | contrato de respuesta |
| C5 | Acceso a datos mysql2 | 10 | `src/repositories/` |
| C6 | Validación y reglas | 10 | `src/services/` |
| C7 | Auth y autorización | 10 | JWT + bcrypt + BD |
| C8 | RNF backend | 5 | bitácora, Ley 1581, SAF, log |
| C9 | Colección Postman | 5 | `docs/postman/` |
| C10 | Repo Git + README + SCRUM | 3 | Git + `docs/scrum/` |
| C11 | Sustentación individual | 10 | demo + preguntas |

> **Aprobación:** `C1 Excelente` + `C7 ≥ 6` + `C11 ≥ 6` + `total ≥ 70`.

---

## 13. CÓMO CONTINUAR ESTE PROYECTO (protocolo para un modelo nuevo)

1. **Lee este README completo** y `PLAN-TRABAJO.md`.
2. **NO** ejecutes ninguna fase sin que el usuario lo indique.
3. Cuando el usuario diga *"arranca la fase N"*:
   - Explica en español **qué** harás, **por qué** y **cómo**.
   - Escribe el código con **comentarios en español** y encabezado didáctico.
   - Usa **`async/await`** para todo acceso a BD.
   - Aplica las reglas **P1–P6** (POO) y las **RN** de la sección 2.
4. Al terminar, actualiza la **bitácora** en `PLAN-TRABAJO.md` (sección 11) y en la
   sección 11 de este README.
5. Si algo no está claro, **pregunta antes de codificar**.

---

## 14. ERRORES COMUNES Y SOLUCIONES

| Error | Causa | Solución |
|---|---|---|
| `ECONNREFUSED` | MySQL no está corriendo | Iniciar el servicio `MySQL80` |
| `ER_ACCESS_DENIED` | Credenciales mal en `.env` | Revisar `DB_USUARIO` y `DB_CLAVE` |
| `Unknown database` | Falta crear el esquema | Ejecutar `database/01_schema.sql` |
| `Cannot find module` | Faltan dependencias | `npm install` |
| Puerto ocupado | Otra app en el 3000 | Cambiar `PUERTO` en `.env` |
| `ER_DUP_ENTRY` | Violación de índice único | Devolver `409` con mensaje claro |
| Token inválido/expirado | JWT mal formado o vencido | Volver a hacer `login` |
