# Sprint Planning — API Discoteca (Evidencia 2)

> Equipo: **Equipo Backend Discoteca** (ficha 3489088).
> Fuente de alcance: `PLAN-TRABAJO.md` §8 (54 fases) y `parametrization/ssr.md`.

## Sprint 1 — Cimientos, seguridad y catálogos (fases 1–28)

**Objetivo:** API arrancable con autenticación, autorización por permisos y
catálogos completos, con trazabilidad de cada operación sensible.

| Alcance | Fases | Criterio |
|---|---|---|
| Plan, estructura del repo, pool de conexiones, utils y middleware | 1–11 | C3, C5 |
| Roles y permisos (CRUD + N:M con mínimo 1 permiso) | 12–16 | C4, C6 |
| Contraseña hasheada (bcrypt), JWT, login/logout/registro/perfil, recuperar/restablecer | 17–21 | C7 |
| Bitácora de creación/edición/anulación | 22 | C8 |
| Proveedores, productos, servicios, categorías, empleados y clientes | 23–28 | C5 |

**Criterios de aceptación del sprint:**
- `GET /api/salud` responde y el servidor arranca con `.env` validado.
- Un rol no puede quedarse sin permisos (409 `ROL_SIN_PERMISOS`).
- Todo endpoint sensible exige `Authorization: Bearer {{token}}`.
- La bitácora registra altas, ediciones y anulaciones.

**Estado final: TERMINADO** (commits de las fases 1–28 en `main`).

## Sprint 2 — Negocio, reportes y entrega (fases 29–54)

**Objetivo:** cerrar el ciclo compras → reservas → ingresos → eventos → ventas
con fidelización, reportes de desempeño y la evidencia completa de la rúbrica.

| Alcance | Fases | RN |
|---|---|---|
| Compras con transacción de stock + alertas de inventario | 29–31 | RN-01, RN-03 |
| Agenda de empleados, reservas con conflicto de horario y QR | 32–35 | RN-02, RN-04 |
| Ingreso por QR, aforo y alerta al 90 % | 36–37 | RN-05, RN-06 |
| Eventos, ficha técnica 1:1, agenda de eventos y notificaciones simuladas | 38–40 | RN-07, RN-08 |
| Ventas con IVA y comprobante, programa de puntos, notificaciones | 41–44 | RN-09 a RN-12 |
| Reportes de desempeño | 45–48 | — |
| Seed, colección Postman, UML, trazabilidad, pruebas y README final | 49–54 | C1, C2, C9, C10 |

**Criterios de aceptación del sprint:**
- `npm test` en verde (suite unitaria `node --test`).
- `npm run test:e2e` en verde (colección Postman completa: 135 peticiones, 213 afirmaciones).
- `docs/TRAZABILIDAD.md` cubre los 93 RF del SRS.
- Tag `v1.0-evidencia2` publicado en el repo.

**Estado final: TERMINADO.**
