# TRAZABILIDAD — Requisitos funcionales → Endpoints

> **Documento exigido por el criterio C1 de la rúbrica** (22 pts, el de mayor peso).
> Su función es demostrar que **cada requisito funcional del SRS tiene al menos un
> endpoint que lo resuelve** y que **ningún endpoint queda sin requisito**.

---

## Cómo leer este documento

| Columna | Significado |
|---|---|
| **ID** | Código del requisito tal como aparece en el SRS (`SRS-Discoteca-v1.0.md`, sección 4) |
| **Requerimiento** | Texto funcional, resumido |
| **Endpoint(s)** | Ruta(s) HTTP que lo implementan. Varias rutas separadas por `<br>` |
| **Fase** | Fase del plan (`PLAN-TRABAJO.md`) que lo construye |
| **Estado** | ⏳ pendiente · 🔄 en curso · ✅ implementado y probado |

**Reglas de la matriz:**

1. Todo RF de la sección 4 del SRS **debe** aparecer aquí. Ninguno se omite.
2. Un RF puede cubrirse con varios endpoints; se listan todos.
3. Un endpoint solo aparece si resuelve un RF (los de infraestructura van en la sección 3).
4. Se marca ✅ **solo** después de probar el endpoint en Postman.

---

## 1. Matriz RF → Endpoint

### 1.1 Configuración: Roles y Permisos (`ROL`)

| ID | Requerimiento | Endpoint(s) | Fase | Estado |
|---|---|---|---|---|
| RF-ROL-01 | Crear un rol con nombre único y asignarle permisos específicos | `POST /api/roles`<br>`POST /api/roles/:id/permisos` | 15, 16 | ⏳ |
| RF-ROL-02 | Listar, buscar, editar, cambiar estado y quitar permisos de un rol | `GET /api/roles`<br>`GET /api/roles/:id`<br>`PUT /api/roles/:id`<br>`PATCH /api/roles/:id/estado`<br>`DELETE /api/roles/:id/permisos/:idPermiso` | 15, 16 | ⏳ |

> **Endpoints de soporte** (sin RF propio, necesarios para el CRUD):
> `GET /api/permisos`, `POST /api/permisos`, `PUT /api/permisos/:id`,
> `PATCH /api/permisos/:id/estado`, `DELETE /api/permisos/:id` — Fase 14.

---

### 1.2 Usuarios y Acceso (`USR`, `ACC`)

| ID | Requerimiento | Endpoint(s) | Fase | Estado |
|---|---|---|---|---|
| RF-USR-01 | Crear, listar, buscar, editar y cambiar el estado de un usuario | `POST /api/usuarios`<br>`GET /api/usuarios`<br>`GET /api/usuarios/:id`<br>`PUT /api/usuarios/:id`<br>`PATCH /api/usuarios/:id/estado` | 18 | ⏳ |
| RF-ACC-01 | Iniciar sesión, cerrar sesión, registrarse, editar mi perfil, recuperar y restablecer contraseña | `POST /api/auth/login`<br>`POST /api/auth/logout`<br>`POST /api/auth/registro`<br>`GET /api/auth/mi-perfil`<br>`PUT /api/auth/mi-perfil`<br>`POST /api/auth/recuperar`<br>`POST /api/auth/restablecer` | 20, 21 | ⏳ |

---

### 1.3 Compras, Proveedores y Existencias (`COM`)

| ID | Requerimiento | Endpoint(s) | Fase | Estado |
|---|---|---|---|---|
| RF-COM-01 | Crear una compra a un proveedor con productos (cantidad y precio), editarla y anularla | `POST /api/compras`<br>`GET /api/compras`<br>`GET /api/compras/:id`<br>`PUT /api/compras/:id`<br>`PATCH /api/compras/:id/anular` | 29, 30 | ⏳ |
| RF-COM-02 | Registrar, listar, buscar, editar y cambiar estado de un proveedor | `POST /api/proveedores`<br>`GET /api/proveedores`<br>`GET /api/proveedores/:id`<br>`PUT /api/proveedores/:id`<br>`PATCH /api/proveedores/:id/estado` | 23 | ⏳ |
| RF-COM-03 | Crear producto con stock mínimo y máximo; listar, buscar y editar la existencia | `POST /api/productos`<br>`GET /api/productos`<br>`GET /api/productos/:id`<br>`PUT /api/productos/:id`<br>`PATCH /api/productos/:id/estado` | 24 | ⏳ |
| RF-COM-04 | Al confirmar la compra, incrementar el stock de cada producto según la cantidad | `POST /api/compras/:id/confirmar` | 30 | ⏳ |
| RF-COM-05 | Alerta visible en el panel cuando el stock llega al stock mínimo | `GET /api/productos/alertas-stock` | 31 | ⏳ |

---

### 1.4 Ingreso y Clientes VIP (`ING`)

| ID | Requerimiento | Endpoint(s) | Fase | Estado |
|---|---|---|---|---|
| RF-ING-01 | Generar código QR de ingreso por reserva confirmada y validarlo en puerta | `POST /api/ingresos/qr`<br>`POST /api/ingresos/validar` | 36 | ⏳ |
| RF-ING-02 | Registrar cada ingreso con fecha, hora, puerta y tipo de dispositivo | `GET /api/ingresos`<br>`GET /api/ingresos/:id` | 36 | ⏳ |
| RF-ING-03 | Registrar, consultar, actualizar y cambiar estado de un cliente VIP (acceso prioritario y beneficios) | `POST /api/clientes`<br>`GET /api/clientes`<br>`GET /api/clientes/:id`<br>`PUT /api/clientes/:id`<br>`PATCH /api/clientes/:id/estado` | 28 | ⏳ |

---

### 1.5 Servicios, Empleados, Agenda y Reservas (`SER`)

| ID | Requerimiento | Endpoint(s) | Fase | Estado |
|---|---|---|---|---|
| RF-SER-01 | Registrar, consultar, actualizar y cambiar estado de los servicios de la discoteca | `POST /api/servicios`<br>`GET /api/servicios`<br>`GET /api/servicios/:id`<br>`PUT /api/servicios/:id`<br>`PATCH /api/servicios/:id/estado` | 25 | ⏳ |
| RF-SER-02 | Registrar categorías de empleados (DJ, mesero, ingreso, administrativo) y asociar empleados | `POST /api/categorias-empleado`<br>`GET /api/categorias-empleado`<br>`PUT /api/categorias-empleado/:id`<br>`POST /api/empleados`<br>`GET /api/empleados`<br>`PUT /api/empleados/:id` | 26, 27 | ⏳ |
| RF-SER-03 | Configurar la agenda de un empleado (servicio o evento, fecha y hora) | `POST /api/agenda-empleados`<br>`GET /api/agenda-empleados`<br>`PUT /api/agenda-empleados/:id`<br>`PATCH /api/agenda-empleados/:id/estado` | 32 | ⏳ |
| RF-SER-04 | Crear, consultar, actualizar y cambiar estado de una reserva VIP/mesa, con descuento y subtotal | `POST /api/reservas`<br>`GET /api/reservas`<br>`GET /api/reservas/:id`<br>`PUT /api/reservas/:id`<br>`PATCH /api/reservas/:id/estado` | 32, 33 | ⏳ |
| RF-SER-05 | Rechazar la reserva si el espacio ya está reservado en ese horario (conflicto → 409) | `POST /api/reservas` (validación de solape) | 33 | ⏳ |

---

### 1.6 Eventos (`EVE`)

| ID | Requerimiento | Endpoint(s) | Fase | Estado |
|---|---|---|---|---|
| RF-EVE-01 | Registrar, consultar, actualizar y cambiar estado de un evento temático | `POST /api/eventos`<br>`GET /api/eventos`<br>`GET /api/eventos/:id`<br>`PUT /api/eventos/:id`<br>`PATCH /api/eventos/:id/estado` | 38 | ⏳ |
| RF-EVE-02 | Crear una ficha técnica por evento (temática, franja horaria, invitados, servicios) | `POST /api/eventos/:id/ficha-tecnica`<br>`GET /api/eventos/:id/ficha-tecnica`<br>`PUT /api/eventos/:id/ficha-tecnica`<br>`DELETE /api/eventos/:id/ficha-tecnica` | 38, 39 | ⏳ |
| RF-EVE-03 | Gestionar la agenda del evento (empleados y servicios) y enviar notificaciones | `POST /api/agenda-eventos`<br>`GET /api/agenda-eventos`<br>`PATCH /api/agenda-eventos/:id/estado`<br>`POST /api/notificaciones`<br>`GET /api/notificaciones` | 40 | ⏳ |

---

### 1.7 Ventas, Clientes y Fidelización (`VEN`)

| ID | Requerimiento | Endpoint(s) | Fase | Estado |
|---|---|---|---|---|
| RF-VEN-01 | Registrar una venta con cliente y productos consumidos, generando comprobante | `POST /api/ventas`<br>`GET /api/ventas`<br>`GET /api/ventas/:id`<br>`POST /api/ventas/:id/pagar` | 41 | ⏳ |
| RF-VEN-02 | Registrar, consultar, actualizar y cambiar estado de una categoría de cliente | `POST /api/categorias-cliente`<br>`GET /api/categorias-cliente`<br>`PUT /api/categorias-cliente/:id`<br>`PATCH /api/categorias-cliente/:id/estado` | 26 | ⏳ |
| RF-VEN-03 | Registrar, consultar, actualizar y cambiar estado de un cliente, clasificado por categoría | `POST /api/clientes`<br>`GET /api/clientes`<br>`GET /api/clientes/:id`<br>`PUT /api/clientes/:id`<br>`PATCH /api/clientes/:id/estado` | 28 | ⏳ |
| RF-VEN-04 | Crear un pedido, asociar el cliente, actualizar su estado y generar reportes | `POST /api/ventas` (estado del pedido)<br>`GET /api/reportes/pedidos` | 41, 45 | ⏳ |
| RF-VEN-05 | Enviar notificaciones al cliente (promociones, eventos, cumpleaños) | `POST /api/notificaciones`<br>`GET /api/notificaciones`<br>`POST /api/notificaciones/cumpleanos` | 40 | ⏳ |
| RF-VEN-06 | Acumular puntos por compra y permitir su canje según el programa de puntos | `GET /api/clientes/:id/puntos`<br>`POST /api/clientes/:id/puntos/canjear` | 43 | ⏳ |

---

### 1.8 Medición de Desempeño (`DES`)

| ID | Requerimiento | Endpoint(s) | Fase | Estado |
|---|---|---|---|---|
| RF-DES-01 | Reporte Top 10 de clientes VIP y clientes generales | `GET /api/reportes/top-clientes` | 46 | ⏳ |
| RF-DES-02 | Servicios más y menos solicitados; Top 3 de productos menos vendidos en un periodo | `GET /api/reportes/servicios`<br>`GET /api/reportes/productos-bajos` | 46 | ⏳ |
| RF-DES-03 | Reportes de ventas mes a mes (mayor, menor, subtotales) y comparativos entre eventos y fiestas privadas | `GET /api/reportes/ventas-mensuales`<br>`GET /api/reportes/comparativo-eventos` | 47 | ⏳ |

---

## 2. Requerimientos no funcionales (criterio C8)

| RNF | Requerimiento | Implementación | Fase | Estado |
|---|---|---|---|---|
| RNF-BITACORA | Registrar quién hizo qué y cuándo sobre los registros importantes | Tabla `bitacora` + `middleware/bitacora.js` | 10, 22 | ⏳ |
| RNF-LOG | Log de errores con formato `fecha - nivel - mensaje - detalle` | `src/middleware/logger.js` | 8 | ✅ |
| RNF-AFORO | Tope de aforo (SAF): alerta al 90 % y bloqueo al 100 % | `AFORO` en `utils/constants.js` + validación de reserva | 10, 34 | ⏳ |
| RNF-LEY1581 | Protección de datos personales: consentimiento y mínimo de datos | Columnas de consentimiento en `clientes` + validaciones de mínimo de datos | 28 | ⏳ |
| RNF-AUDITORIA-ACCESO | Registro de accesos (login/logout/resultado) | Tabla `accesos` + registro en Fase 20 | 20 | ⏳ |
| RNF-RDID | Rendimiento: consultas indexadas y paginación obligatoria | Índices revisados (C-02) + `validarPaginacion` | 8, 10 | 🔄 |

---

## 3. Endpoints de infraestructura (sin RF propio)

| Endpoint | Propósito | Fase | Estado |
|---|---|---|---|
| `GET /api/salud` | Health check: estado del servidor y de la base de datos | 9 | ✅ |

---

## 4. Resumen de cobertura

| Grupo | RF total | ✅ | 🔄 | ⏳ |
|---|---|---|---|---|
| ROL — Roles y permisos | 2 | 0 | 0 | 2 |
| USR/ACC — Usuarios y acceso | 2 | 0 | 0 | 2 |
| COM — Compras/proveedores/existencias | 5 | 0 | 0 | 5 |
| ING — Ingreso y VIP | 3 | 0 | 0 | 3 |
| SER — Servicios/empleados/agenda/reservas | 5 | 0 | 0 | 5 |
| EVE — Eventos | 3 | 0 | 0 | 3 |
| VEN — Ventas/clientes/fidelización | 6 | 0 | 0 | 6 |
| DES — Medición de desempeño | 3 | 0 | 0 | 3 |
| **TOTAL** | **29** | **0** | **0** | **29** |

> Esta tabla se actualiza en cada fase que implemente endpoints.

---

## 5. Fuente de los requisitos

- **SRS:** `proyectoinfo/Requisitos (SRS)/SRS-Discoteca-v1.0.md` (sección 4, `4.1` a `4.8`).
- **Copia de trabajo:** `Backend-proyecto discoteca/parametrization/ssr.md`.
- **Anexo A:** no disponible (no fue entregado por el instructor). Por eso se
  documenta **la totalidad** de los 29 RF en lugar de separar núcleo/electivo;
  esto cubre de sobra cualquier posible núcleo (ver `PLAN-TRABAJO.md` §7).
