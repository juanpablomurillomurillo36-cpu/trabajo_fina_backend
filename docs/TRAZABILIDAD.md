# TRAZABILIDAD — Requisitos funcionales ↔ Endpoints

> **Documento exigido por el criterio C1 de la rúbrica** (el de mayor peso).
> Su función es demostrar que **cada requisito funcional del SRS (`parametrization/ssr.md`)
> tiene al menos un endpoint que lo resuelve** y que **ningún endpoint queda sin requisito**.

---

## Cómo leer este documento

| Columna | Significado |
|---|---|
| **ID** | Código del requisito tal como aparece en el SRS (se conserva **tal cual**, ver nota 1) |
| **Descripción** | Texto funcional, resumido |
| **Endpoint(s)** | Ruta(s) HTTP que lo implementan |
| **Fase** | Fase del plan (`PLAN-TRABAJO.md` §8) que lo construye |
| **Evidencia** | Petición manual en Postman (URL y body en `PRUEBAS.md`) u otra prueba que lo verifica |

**Reglas de la matriz:**

1. Todo RF de la sección 4 del SRS aparece aquí. Ninguno se omite (93 filas).
2. Un RF puede cubrirse con varios endpoints; se listan todos.
3. La columna Evidencia cita peticiones ejecutadas **a mano en Postman** contra el
   servidor corriendo; `PRUEBAS.md` trae la URL y el body de cada una.
4. Los IDs anómalos del SRS (duplicados, con punto, sin guion, con 3 dígitos) se
   conservan sin corregir para poder citar el documento fuente sin ambigüedad.

---

## 1. Matriz RF → Endpoint

### 1.1 Roles y permisos (SRS 4.1)

| ID | Descripción | Endpoint(s) | Fase | Evidencia |
|---|---|---|---|---|
| RF-ROL-01 | Crear un rol con nombre único | `POST /api/roles` | 15 | Postman: `POST /api/roles` (nombre repetido → 409) |
| RF-ROL-02 | Asignar permisos específicos a un rol | `POST /api/roles/:id/permisos` | 16 | Postman: `POST /api/roles/:id/permisos (asigna el permiso capturado)` |
| RF-ROL-03 (a) | Buscar permisos asociados a un rol | `GET /api/roles/:id/permisos` | 16 | Postman: `GET /api/roles/:id/permisos` |
| RF-ROL-03 (b) | Editar los permisos asociados a un rol (quitar + asignar) | `DELETE /api/roles/:id/permisos/:idPermiso`<br>`POST /api/roles/:id/permisos` | 16 | Postman: ciclo de permisos del rol (valida `totalPermisos`) |
| RF-ROL-04 | Cambiar el estado de los permisos asociados a un rol | `POST /api/roles/:id/permisos` · `DELETE /api/roles/:id/permisos/:idPermiso` (la N:M se modela como alta/baja) | 16 | Postman: ciclo de permisos del rol |
| RF-ROL-05 | Eliminar los permisos asociados a un rol | `DELETE /api/roles/:id/permisos/:idPermiso` | 16 | Postman: `DELETE permiso del rol (409: conserva al menos 1)` |
| RF-ROL-06 | Listar los permisos asociados a un rol | `GET /api/roles/:id/permisos` | 16 | Postman: `GET /api/roles/:id/permisos` |

> Los CRUD de permisos sueltos (`GET/POST/PUT/DELETE /api/permisos`, fases 13–14)
> sustentan el catálogo que consumen los RF-ROL-02 a 06.

### 1.2 Usuarios y acceso (SRS 4.2)

| ID | Descripción | Endpoint(s) | Fase | Evidencia |
|---|---|---|---|---|
| RF-USR-01 | Crear un usuario (estado inicial) | `POST /api/usuarios` | 18 | Postman: `POST /api/usuarios` (contraseña hasheada) |
| RF-USR-02 | Listar usuarios | `GET /api/usuarios` | 18 | Postman: `GET /api/usuarios` |
| RF-USR-03 | Buscar un usuario | `GET /api/usuarios/:id` | 18 | Postman: `GET /api/usuarios/:id` |
| RF-USR-04 | Editar un usuario | `PUT /api/usuarios/:id` | 18 | Postman: `PUT /api/usuarios/:id` |
| RF-USR-05 | Cambiar el estado de un usuario | `PATCH /api/usuarios/:id/estado` | 18 | Postman: `PATCH /api/usuarios/:id/estado` |
| RF-ACC-01 | Iniciar sesión | `POST /api/auth/login` | 20 | Postman: `POST /api/auth/login` (genera `{{token}}`) |
| RF-ACC-02 | Cerrar sesión | `POST /api/auth/logout` | 20 | Postman: `POST /api/auth/logout` |
| RF-ACC-03 | Registrarse | `POST /api/auth/registro` | 20 | Postman: `POST /api/auth/registro` (público, crea cliente) |
| RF-ACC-04 | Editar mi perfil | `GET /api/auth/mi-perfil`<br>`PUT /api/auth/mi-perfil` | 20 | Postman: `GET / PUT /api/auth/mi-perfil` |
| RF-ACC-05 | Recuperar mi contraseña | `POST /api/auth/recuperar-password` | 21 | Postman: `POST /api/auth/recuperar-password` (captura código) |
| RF-ACC-06 | Restablecer mi contraseña | `POST /api/auth/restablecer-password` | 21 | Postman: `POST /api/auth/restablecer-password` |

### 1.3 Compras, proveedores y existencias (SRS 4.3)

| ID | Descripción | Endpoint(s) | Fase | Evidencia |
|---|---|---|---|---|
| RF-COM-01 | Crear una compra, agregar productos, editarla y anularla | `POST /api/compras`<br>`PUT /api/compras/:id`<br>`POST /api/compras/:id/cancelar` | 29 | Postman: ciclo de compras (crear → editar → confirmar → anular) |
| RF-COM-02 | Asignar a una compra productos con cantidad y precio | `POST /api/compras` (campo `detalles[]`) | 29 | Postman: `POST /api/compras (demo, 2 productos)` |
| RF-COM-03 | Editar una compra | `PUT /api/compras/:id` | 29 | Postman: `PUT /api/compras/:id` (solo si pendiente) |
| RF-COM-04 | Anular una compra | `POST /api/compras/:id/cancelar` | 30 | Postman: `POST /api/compras/:id/cancelar (pasa a anulada)` |
| RF-COM-05 | Registrar el estado de un proveedor | `POST /api/proveedores` | 23 | Postman: `POST /api/proveedores` (RFC único → 409) |
| RF-COM-06 | Listar proveedores | `GET /api/proveedores` | 23 | Postman: `GET /api/proveedores` |
| RF-COM-07 | Buscar un proveedor | `GET /api/proveedores/:id` | 23 | Postman: `GET /api/proveedores/:id` |
| RF-COM-08 | Editar un proveedor | `PUT /api/proveedores/:id` | 23 | Postman: `PUT /api/proveedores/:id` |
| RF-COM-09 | Cambiar el estado de un proveedor | `PATCH /api/proveedores/:id/estado` | 23 | Postman: `PATCH /api/proveedores/:id/estado` |
| RF-COM-10 | Crear un producto con su stock | `POST /api/productos` | 24 | Postman: `POST /api/productos` |
| RF-COM-11 | Asignar stock mínimo y máximo a un producto | `POST /api/productos` · `PUT /api/productos/:id` (`stockMinimo`/`stockMaximo`) | 24 | Postman: ciclo de productos |
| RF-COM-12 | Listar las existencias de los productos | `GET /api/productos` | 24 | Postman: `GET /api/productos` |
| RF-COM-13 | Buscar las existencias de un producto | `GET /api/productos/:id` | 24 | Postman: `GET /api/productos/:id` |
| RF-COM-14 | Editar las existencias de un producto | `PUT /api/productos/:id` | 24 | Postman: `PUT /api/productos/:id` |
| RF-COM-15 | Al confirmar la compra, incrementar el stock de cada producto | `POST /api/compras/:id/confirmar` | 30 | Postman: `POST /api/compras/:id/confirmar (suma stock)` |
| RF-COM-16 | Alerta de stock mínimo en el panel del Administrador | `GET /api/inventario/alertas` | 31 | Postman: `GET /api/inventario/alertas` |

### 1.4 Ingreso y clientes VIP (SRS 4.4)

| ID | Descripción | Endpoint(s) | Fase | Evidencia |
|---|---|---|---|---|
| RF-ING-01 | Generar el código QR de ingreso por reserva confirmada | `POST /api/reservas/:id/qr` | 35 | Postman: `POST /api/reservas/:id/qr (genera el codigo)` |
| RF-ING-02 | Validar el QR en la puerta de acceso | `POST /api/ingresos/validar` | 36 | Postman: `POST /api/ingresos/validar (escaneo real del QR)` |
| RF-ING-03 | Registrar cada ingreso con fecha, hora, puerta y dispositivo | `POST /api/ingresos/validar`<br>`GET /api/ingresos` | 36 | Postman: `GET /api/ingresos (historial)` |
| RF-ING-04 | Registrar el estado VIP de un cliente | `POST /api/clientes` (campo `esVip`) | 28 | Postman: ciclo de clientes (`esVip`) |
| RF-ING-05 | Consultar el estado VIP de un cliente | `GET /api/clientes/:id` (`esVip`) | 28 | Postman: `GET /api/clientes/:id` |
| RF-ING-06 | Actualizar el estado VIP de un cliente | `PUT /api/clientes/:id` (`esVip`) | 28 | Postman: `PUT /api/clientes/:id` |
| RF-ING-07 | Cambiar el estado de un cliente VIP | `PATCH /api/clientes/:id/estado` | 28 | Postman: `PATCH /api/clientes/:id/estado` |

### 1.5 Servicios, empleados y reservas (SRS 4.5)

| ID | Descripción | Endpoint(s) | Fase | Evidencia |
|---|---|---|---|---|
| RF-SER-01 | Registrar el estado de los servicios | `POST /api/servicios` | 25 | Postman: `POST /api/servicios` |
| RF-SER-02 | Consultar el estado de los servicios | `GET /api/servicios` | 25 | Postman: `GET /api/servicios` |
| RF-SER-03 | Actualizar un servicio | `PUT /api/servicios/:id` | 25 | Postman: `PUT /api/servicios/:id` |
| RF-SER-04 | Cambiar el estado de un servicio | `PATCH /api/servicios/:id/estado` | 25 | Postman: `PATCH /api/servicios/:id/estado` |
| RF-SER-05 | Crear categorías de empleados (DJ, mesero, ingreso, administrativo) | `POST /api/categorias-empleados` | 26 | Postman: `POST /api/categorias-empleados` (ENUM + 4 cargos sembrados) |
| RF-SER-06 | Asociar un empleado a una categoría | `POST /api/empleados` (campo `idCategoria`) | 27 | Postman: `POST /api/empleados` (categoría debe existir y estar activa) |
| RF-SER-07 | Configurar la agenda de un empleado (servicio, fecha y hora) | `POST /api/agenda` | 32 | Postman: ciclo de agenda de empleados |
| RF-SER-08 | Crear una reserva asociada a un espacio VIP o mesa | `POST /api/reservas` | 33 | Postman: `POST /api/reservas (demo, espacio unico)` |
| RF-SER-09 | Consultar el estado de una reserva | `GET /api/reservas/:id` | 33 | Postman: `GET /api/reservas/:id (detalle del demo)` |
| RF-SER-10 | Actualizar una reserva | `PUT /api/reservas/:id` | 33 | Postman: `PUT /api/reservas/:id (cambia la hora)` (solo pendiente) |
| RF-SER-11 | Cambiar el estado de una reserva | `PATCH /api/reservas/:id/estado` | 34 | Postman: `PATCH /api/reservas/:id/estado (confirmada)` |
| RF-SER-12 | Calcular el subtotal de la reserva | `POST /api/reservas` (subtotal = suma de líneas) | 33 | Postman: detalle del demo (`subtotal`) |
| RF-SER-13 | Aplicar un descuento a la reserva | `POST /api/reservas` · `PUT /api/reservas/:id` (campo `descuento`) | 33 | Postman: cuerpo de reserva con descuento |
| RF-SER14 | Calcular el valor del descuento aplicado | `GET /api/reservas/:id` (`total` = subtotal − descuento) | 33 | Postman: `GET /api/reservas/:id (detalle del demo)` |
| RF-SER-015 | Rechazar la reserva si el espacio ya está reservado en el mismo horario | `POST /api/reservas` → **409** (`uq_reserva_espacio_horario` + verificación de servicio) | 34 | Restricción única + prueba unitario (fase 53) |

### 1.6 Eventos (SRS 4.6)

| ID | Descripción | Endpoint(s) | Fase | Evidencia |
|---|---|---|---|---|
| RF-EVE-01 | Registrar un evento temático | `POST /api/eventos` | 38 | Postman: `POST /api/eventos (demo fiesta privada, C-07)` |
| RF-EVE-02 | Consultar el estado de un evento | `GET /api/eventos/:id` | 38 | Postman: `GET /api/eventos/:id (tipo fiesta privada)` |
| RF-EVE.03 | Actualizar un evento (ID con punto en el SRS) | `PUT /api/eventos/:id` | 38 | Postman: `PUT /api/eventos/:id (pasa a tematico)` |
| RF-EVE-04 | Actualizar un evento temático | `PUT /api/eventos/:id` | 38 | Postman: `PUT /api/eventos/:id (pasa a tematico)` |
| RF-EVE-05 | Cambiar el estado de un evento | `PATCH /api/eventos/:id/estado` | 38 | Postman: `PATCH /api/eventos/:id/estado (-> cancelado)` |
| RF-EVE-06 | Crear la ficha técnica por evento (temática, franja, invitados) | `POST /api/eventos/:id/ficha` | 39 | Postman: `POST /api/eventos/:id/ficha (una por evento, C6)` |
| RF-EVE-07 | Asociar servicios a un evento | `POST /api/eventos/:id/ficha` · `PUT /api/eventos/:id/ficha` (campo `servicios[]`, N:N) | 39 | Composición `crearConServicios` (ficha-tecnica) |
| RF-EVE-08 | Asociar empleados a un evento | `POST /api/agenda` (empleado+servicio+fecha)<br>`POST /api/agenda-eventos` | 32, 40 | Postman: agenda de empleados + `POST /api/agenda-eventos (tarea del evento)` |
| RF-EVE-09 | Gestionar la agenda de un evento | `GET/POST/PUT/PATCH/DELETE /api/agenda-eventos` | 40 | Postman: ciclo agenda-eventos (PUT, PATCH estado, DELETE) |
| RF-EVE-10 | Notificar a los empleados fechas clave del evento | Tabla `notificaciones` + log (simulado, sin proveedor — TBD-02) | 40 | Registros en `notificaciones` y `bitacora` |
| RF-EVE-11 | Notificar a los clientes fechas clave del evento | Tabla `notificaciones` + log (simulado, sin proveedor — TBD-02) | 44 | Registros en `notificaciones` y `bitacora` |

### 1.7 Ventas, clientes y fidelización (SRS 4.7)

| ID | Descripción | Endpoint(s) | Fase | Evidencia |
|---|---|---|---|---|
| RF-VEN-01 | Registrar una venta (cliente + productos consumidos) | `POST /api/ventas` | 41 | Postman: `POST /api/ventas (demo, 2 lineas)` |
| RF-VEN-02 | Generar un comprobante de pago | `POST /api/ventas/:id/pagar` (`comprobanteNo` COM-…) | 42 | Postman: `POST /api/ventas/:id/pagar (IVA + comprobante + puntos)` |
| RF-VEN-03 | Registrar el estado de una categoría de cliente | `POST /api/categorias-clientes` | 26 | Postman: ciclo de categorías de clientes |
| RF-VEN-04 | Consultar el estado de una categoría de cliente | `GET /api/categorias-clientes` | 26 | Postman: `GET /api/categorias-clientes` |
| RF-VEN-05 | Actualizar una categoría de cliente | `PUT /api/categorias-clientes/:id` | 26 | Postman: `PUT /api/categorias-clientes/:id` |
| RF-VEN-06 | Cambiar el estado de una categoría de cliente | `PATCH /api/categorias-clientes/:id/estado` | 26 | Postman: `PATCH /api/categorias-clientes/:id/estado` |
| RF-VEN-07 | Registrar, consultar y actualizar un cliente por categoría | `POST /api/clientes`<br>`GET /api/clientes` · `GET /api/clientes/:id`<br>`PUT /api/clientes/:id` | 28 | Postman: ciclo de clientes |
| RF-VEN-08 | Consultar clientes clasificados por categoría | `GET /api/clientes` · `GET /api/clientes/:id` (`idCategoria`) | 28 | Postman: `GET /api/clientes` |
| RF-VEN-09 | Actualizar un cliente (clasificación por categoría) | `PUT /api/clientes/:id` | 28 | Postman: `PUT /api/clientes/:id` |
| RF-VEN-10 | Cambiar el estado de un cliente | `PATCH /api/clientes/:id/estado` | 28 | Postman: `PATCH /api/clientes/:id/estado` |
| RF-VEN-11 | Crear un pedido | `POST /api/ventas` (estado `pendiente`) | 41 | Postman: `POST /api/ventas (otra pendiente, para borrar)` |
| RF-VEN-12 | Asociar un pedido a un cliente | `POST /api/ventas` (campo `idCliente`) | 41 | Postman: ciclo de ventas |
| RF-VEN-13 | Actualizar el estado de un pedido | `PUT /api/ventas/:id`<br>`PATCH /api/ventas/:id/estado` | 41 | Postman: `PUT /api/ventas/:id (edita mientras esta pendiente)` |
| RF-VEN-14 | Generar reportes de los pedidos | `GET /api/ventas` · `GET /api/ventas/:id` | 41 | Postman: `GET /api/ventas` |
| RF-VEN-15 | Notificar a clientes promociones, eventos y cumpleaños | Tabla `notificaciones` + log (simulado — TBD-02) | 44 | Registros en `notificaciones` y `bitacora` |
| RF-VEN-16 | Acumular puntos por compra y permitir su canje | `POST /api/ventas/:id/pagar` (acumula 1 punto por $10)<br>`GET /api/puntos/:idCliente`<br>`POST /api/puntos/:idCliente/canjear` (máx. 50 %) | 43 | Postman: ciclo de puntos (saldo, canje 50 %) |

### 1.8 Medición de desempeño (SRS 4.8)

| ID | Descripción | Endpoint(s) | Fase | Evidencia |
|---|---|---|---|---|
| RF-DES-01 | Top 10 de clientes VIP | `GET /api/reportes/top-clientes?tipo=vip` | 45 | Postman: `GET /api/reportes/top-clientes?tipo=vip` |
| RF-DES-02 | Top 10 de clientes generales | `GET /api/reportes/top-clientes?tipo=general` | 45 | Postman: `GET /api/reportes/top-clientes?tipo=general` |
| RF-DES-03 | Servicios más solicitados | `GET /api/reportes/servicios-solicitados` (`masSolicitados`) | 46 | Postman: `GET /api/reportes/servicios-solicitados` |
| RF-DES-04 | Servicios menos solicitados | `GET /api/reportes/servicios-solicitados` (`menosSolicitados`) | 46 | Postman: `GET /api/reportes/servicios-solicitados` |
| RF-DES-05 | Top 3 de productos menos vendidos | `GET /api/reportes/productos-menos-vendidos` | 46 | Postman: `GET /api/reportes/productos-menos-vendidos` |
| RF-DES-06 | Reportes de ventas mes a mes | `GET /api/reportes/ventas-por-mes?anio=` | 47 | Postman: `GET /api/reportes/ventas-por-mes?anio=2026` |
| RF-DES-07 | Día y mes de mayor venta | `GET /api/reportes/ventas-mayor-menor` | 47 | Postman: `GET /api/reportes/ventas-mayor-menor` |
| RF-DES-08 | Día y mes de menor venta | `GET /api/reportes/ventas-mayor-menor` | 47 | Postman: `GET /api/reportes/ventas-mayor-menor` |
| RF-DES-09 | Subtotales de ventas mensuales | `GET /api/reportes/ventas-subtotales` | 47 | Postman: `GET /api/reportes/ventas-subtotales` |
| RF-DES-10 | Comparativo eventos temáticos vs fiestas privadas | `GET /api/reportes/comparativo-eventos` | 48 | Postman: `GET /api/reportes/comparativo-eventos (RF-DES-10)` |

---

## 2. Requerimientos no funcionales y reglas de negocio (SRS 5)

### 2.1 RNF

| ID | Descripción | Implementación | Fase | Evidencia |
|---|---|---|---|---|
| RNF-REN-01 | Validación de QR en < 3 s | Capa servicio `async/await` sin bloqueo + pool de conexiones | 4, 36 | Arquitectura sin I/O bloqueante; prueba de carga fuera del alcance del repo |
| RNF-REN-02 | Soportar 300 ingresos concurrentes | Pool de conexiones MySQL (`config/database.js`) | 4 | Pool configurado con límite y espera |
| RNF-SEG-01 | TLS 1.2+ en toda comunicación | Despliegue en servidor con certificado (infraestructura) | — | Configuración de servidor (fuera del repo) |
| RNF-SEG-02 | Bitácora de creación/edición/anulación de compras, ventas, reservas y roles | `middleware/bitacora.js` + tabla `bitacora` | 22 | Inspección del middleware + tabla `bitacora` poblada |
| RNF-PRI-01 | Ley 1581 de 2012 (datos personales mínimos) | Esquema con solo los campos necesarios en `usuarios`/`clientes` | 18, 28 | Inspección del esquema (`01_schema.sql`) |
| RNF-CAL-01 | Disponibilidad 99.5 % en horario nocturno | Infraestructura del servidor (fuera del repo) | — | Análisis de despliegue |
| RNF-USA-01 | Validación de campos obligatorios antes del envío | `ColectorErrores` + validadores → 400 con `detalles[]` por campo | 7 | Prueba global: respuestas 400 con lista de campos inválidos |
| RNF-SAF-01 | Alerta al acercarse al límite de aforo (90 %) | `GET /api/ingresos/aforo` + alerta de sobreocupación | 37 | Postman: `GET /api/ingresos/aforo` |

### 2.2 Reglas de negocio (SRS 5.5)

| ID | Regla | Implementación | Fase | Evidencia |
|---|---|---|---|---|
| RN-01 | El cliente VIP tiene acceso prioritario y beneficios exclusivos | Campo `esVip` en `clientes` + espacios/tipos VIP en reservas. Sin precio diferencial (alcance backend de la Evidencia 2) | 28, 33 | Postman: clientes (`esVip`) y reservas por tipo de espacio |
| RN-02 | No se puede reservar el mismo espacio dos veces en el mismo horario | `uq_reserva_espacio_horario` + verificación de conflicto → 409 | 34 | Restricción única en `01_schema.sql` + prueba unitaria (fase 53) |
| RN-03 | Los puntos se acumulan por compra y se canjean según la tasa del negocio | 1 punto por cada $10 al pagar; canje máximo del 50 % del acumulado | 42, 43 | Postman: `pagar` + `canjear (50 % maximo)` |

---

## 3. Notas

1. **IDs anómalos del SRS** (conservados tal cual, sin corrección):
   `RF-ROL-03` aparece dos veces (buscar y editar permisos; se desglosan como (a) y (b)),
   `RF-SER14` sin guion, `RF-SER-015` con tres dígitos y `RF-EVE.03` con punto en lugar de guion.
2. **Cobertura:** 93 RF del SRS + 8 RNF + 3 RN, todos mapeados a al menos un endpoint,
   prueba o inspección.
3. **Prueba global de la colección:** 135 peticiones y 213 afirmaciones en verde
   (runner propio `test-global.js`, compatible con la sintaxis de la colección Postman).
4. **Notificaciones** (RF-EVE-10/11, RF-VEN-15) están simuladas en base de datos y log
   porque el proveedor de correo/SMS sigue pendiente (TBD-02 del SRS).
5. Los endpoints de infraestructura sin RF directo (`GET /api/salud`, `GET /api/bitacora`)
   se documentan aquí por transparencia: sostienen el arranque y la trazabilidad (C8).
