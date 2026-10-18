# Tablero — API Discoteca (Evidencia 2)

> Tablero simple de dos columnas de sprint (To Do / Done) alineado con las
> fases de `PLAN-TRABAJO.md`. Todo lo marcado **Hecho** está en la rama `main`
> con su commit.

## Sprint 1

| Tarea | Fases | Estado |
|---|---|---|
| Plan, README inicial, copia de la BD `discoteca_api` | 1 | Hecho |
| Estructura `src/`, `database/`, `docs/`, `CAMBIOS.md`, `.gitignore` | 1b | Hecho |
| `package.json`, `.env.example`, dependencias | 2 | Hecho |
| `config/env.js` (valida variables de entorno) | 3 | Hecho |
| `config/database.js` (pool + `ejecutar`/`obtenerUno`/`conTransaccion`) | 4 | Hecho |
| `utils/constants.js`, `AppError.js`, `respuesta.js` | 5 | Hecho |
| `utils/formato.js`, `utils/fechas.js` | 6 | Hecho |
| `utils/mensajes.js`, `validadores.js` (ColectorErrores) | 7 | Hecho |
| `middleware/errorHandler.js`, `logger.js`, `validarParametros.js` | 8 | Hecho |
| `config/express.js` + `src/index.js` + `GET /api/salud` | 9 | Hecho |
| `database/01_schema.sql`, `02_usuario_app.sql`, `CAMBIOS.md` | 10 | Hecho |
| `git init`, `.gitignore`, primer commit | 11 | Hecho |
| Modelos base + `Rol`, `Permiso` | 12 | Hecho |
| CRUD `/api/permisos` | 13–14 | Hecho |
| CRUD `/api/roles` (nombre único → 409) | 15 | Hecho |
| N:M roles↔permisos (mínimo 1 permiso) | 16 | Hecho |
| `cifrado.js` (bcrypt) + `tokens.js` (JWT) | 17 | Hecho |
| Usuarios (contraseña hasheada) | 18 | Hecho |
| `autenticacion.js` + `autorizacion.js` (permisos desde la BD) | 19 | Hecho |
| login, logout, registro, mi-perfil, tabla `accesos` | 20 | Hecho |
| recuperar / restablecer contraseña | 21 | Hecho |
| `middleware/bitacora.js` | 22 | Hecho |
| Proveedores (RFC único) | 23 | Hecho |
| Productos (existencias, stock mínimo) | 24 | Hecho |
| Servicios | 25 | Hecho |
| Categorías de empleados y de clientes | 26 | Hecho |
| Empleados (NSS único) | 27 | Hecho |
| Clientes (RFC único, VIP) | 28 | Hecho |

## Sprint 2

| Tarea | Fases | Estado |
|---|---|---|
| Compras + detalles (composición) CRUD | 29 | Hecho |
| confirmar/cancelar con transacción de stock | 30 | Hecho |
| Alertas de stock mínimo | 31 | Hecho |
| Agenda de empleados | 32 | Hecho |
| Reservas + detalles, subtotal y descuento | 33 | Hecho |
| Conflicto de horario/espacio → 409 | 34 | Hecho |
| QR de ingreso (`codigo_qr` único) | 35 | Hecho |
| Validación de QR en puerta | 36 | Hecho |
| Aforo con alerta al 90 % | 37 | Hecho |
| Eventos CRUD | 38 | Hecho |
| Ficha técnica 1:1 + servicios N:N | 39 | Hecho |
| Agenda de eventos + notificaciones simuladas | 40 | Hecho |
| Ventas + detalles CRUD | 41 | Hecho |
| pagar (IVA + comprobante + stock) | 42 | Hecho |
| Programa de puntos (1 por $10, canje 50 %) | 43 | Hecho |
| Notificaciones simuladas (BD + log) | 44 | Hecho |
| Reportes: top clientes (VIP/general) | 45 | Hecho |
| Reportes: servicios y top 3 productos | 46 | Hecho |
| Reportes: ventas mes a mes, mayor/menor, subtotales | 47 | Hecho |
| Reporte: comparativo eventos vs fiestas privadas | 48 | Hecho |
| Seed coherente con UML y Postman | 49 | Hecho |
| Colección Postman completa (133 requests) | 50 | Hecho |
| UML objetos (2 escenarios, drawio + png) | 51 | Hecho |
| `docs/TRAZABILIDAD.md` (93 RF) | 52 | Hecho |
| Suite `node --test` + prueba global E2E | 53 | Hecho |
| README final, tag `v1.0-evidencia2`, ZIP | 54 | Hecho |

## Inventario final

- Commits en `main`: 57 (empujados a GitHub, HEAD `0d45b9e`, tag `v1.0-evidencia2`).
- Pruebas unitarias: 33 en verde (`npm test`).
- Prueba global E2E: 135 peticiones / 213 afirmaciones en verde (`npm run test:e2e`).
