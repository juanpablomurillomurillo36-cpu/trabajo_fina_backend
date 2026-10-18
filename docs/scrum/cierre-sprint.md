# Cierre de Sprint — API Discoteca (Evidencia 2)

> Documento de cierre de los 2 sprints del proyecto. Resumen de lo entregado,
> verificaciones ejecutadas y pendientes heredados.

## Resultado por sprint

### Sprint 1 (fases 1–28) — TERMINADO

- API arrancable con `GET /api/salud`, entorno validado y pool de conexiones.
- Seguridad completa: bcrypt + JWT, permisos leídos de la BD, middleware de
  autenticación/autorización y bitácora de operaciones sensibles.
- Catálogos: roles, permisos, usuarios, proveedores, productos, servicios,
  categorías, empleados y clientes.

### Sprint 2 (fases 29–54) — TERMINADO

- Ciclo de negocio completo: compras con transacción de stock, reservas con
  detección de conflicto y QR, ingreso validado con aforo, eventos con ficha
  técnica y agenda, ventas con IVA/comprobante y programa de puntos.
- 7 reportes de desempeño (top clientes, servicios, productos, ventas,
  comparativo de eventos).
- Evidencias de rúbrica: colección Postman (133 requests), UML de objetos,
  matriz de trazabilidad (93 RF), suite de pruebas y README final.

## Verificaciones de cierre

| Verificación | Comando | Resultado |
|---|---|---|
| Suite unitaria | `npm test` | 33 pruebas, 0 fallos |
| Prueba global E2E | `npm run test:e2e` (con el servidor corriendo) | 135 peticiones, 213 afirmaciones, 0 fallos |
| Colección Postman | runner propio con shim de `pm.*` | JSON válido, 41 variables generadas |
| Trazabilidad | `docs/TRAZABILIDAD.md` | 93 RF + 8 RNF + 3 RN mapeados |

## Defectos corregidos durante las verificaciones

1. `Reserva.toJSON` y `Venta.toJSON` no exponían `pendiente`; los guards de
   edición respondían 409 siempre (regresión cubierta por `tests/modelos.test.js`).
2. `ProgramaPuntoRepository.canjear` desestructuraba el OkPacket y el canje
   caía en 500.
3. `reporte.service` llamaba a un utilitario inexistente (`formato.aFechaISO`)
   en el reporte de ventas mayor/menor.
4. `formato.aDecimalONulo` devolvía 0 en vez de null para texto sin cifras.

## Pendientes heredados (fuera del alcance del backend)

- TBD-02: proveedor de correo/SMS para las notificaciones (hoy simuladas en BD + log).
- TBD-05: valor exacto del aforo máximo legal (hoy configurable en el servicio de ingreso).
- TLS (RNF-SEG-01) y disponibilidad (RNF-CAL-01) dependen del despliegue, no del repo.
- Interfaz gráfica: fuera de alcance de la Evidencia 2 (sin wireframes, TBD-01).
