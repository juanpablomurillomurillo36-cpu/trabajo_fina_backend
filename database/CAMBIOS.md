# CAMBIOS DE LA BASE DE DATOS — vs EVIDENCIA 1

> **Documento obligatorio de la rúbrica** (`database/ CAMBIOS.md`).
> Registra **cada cambio** que se le hace al esquema de la Evidencia 1,
> con su **SQL** y su **justificación**.

---

## 1. LÍNEA DE PARTIDA (Evidencia 1)

| Ítem | Valor |
|---|---|
| Esquema original | `discoteca_db` (Evidencia 1) — **NO SE TOCA**, se conserva como respaldo |
| Esquema de trabajo | `discoteca_api` (copia exacta de `discoteca_db`) |
| Método de copia | `mysqldump` → `mysql` |
| Tablas | 26 |
| Claves foráneas | 27 |
| Índices únicos | 10 |
| Codificación | `utf8mb4_spanish_ci` |

### Diferencias del esquema real vs el script de parametrización

El esquema `discoteca_api` (heredado de `discoteca_db`) difiere del script
`DB_relational_model.sql` de la parametrización en:

| Área | Esquema real (`discoteca_api`) | Script de parametrización |
|---|---|---|
| Nombres de persona | `nombre` + `apellido` (VARCHAR 80) | 4 columnas separadas |
| Puntos de fidelidad | Tabla aparte `programa_puntos` | Columna en `clientes` |
| Código QR | Columna `codigo_qr` **UNIQUE** en `ingresos` | En `reservas` |
| Espacio del evento | `tipo_espacio` + `identificador_espacio` (clave única) | — |
| Estados | Columnas `ENUM` | `INT` 0/1 |
| Llaves primarias | `id_rol`, `id_usuario`, `id_evento`… | — |

> Estas diferencias **se respetan**: el esquema real manda sobre el script.

---

## 2. CAMBIOS APLICADOS

_Aquí se registra cada cambio real que se ejecute sobre `discoteca_api`._
_Cuando se agregue una fila, se indica: número, fecha, qué, SQL y por qué._

| # | Fecha | Cambio | SQL | Justificación (criterio) | Estado |
|---|---|---|---|---|---|
| — | — | _Sin cambios aplicados aún_ | — | — | — |

---

## 3. CAMBIOS PLANEADOS (se ejecutarán en su fase)

### C-01 — Crear tabla `bitacora` · **Fase 10** · **Criterio C8**

**Qué:** una tabla que registre **quién hizo qué y cuándo** sobre los registros
importantes (creación, edición, anulación).

**Por qué:** el criterio **C8 (RNF backend)** exige explícitamente **bitácora**.
Además es una buena práctica: sin ella no se puede auditar quién borró una venta
o quién cambió el estado de una compra.

**SQL planeado:**

```sql
CREATE TABLE bitacora (
  id_bitacora   INT AUTO_INCREMENT PRIMARY KEY,
  USUARIO_id    INT            NOT NULL,
  tabla         VARCHAR(64)    NOT NULL,
  registro_id   INT            NULL,
  accion        ENUM('CREACION','EDICION','ANULACION') NOT NULL,
  detalle       TEXT           NULL,
  direccion_ip  VARCHAR(45)    NULL,
  fecha         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bitacora_usuario
    FOREIGN KEY (USUARIO_id) REFERENCES usuarios(id_usuario)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
```

**Estado:** ⏳ pendiente (se ejecuta en la Fase 10 junto al `01_schema.sql`).

---

### C-02 — Revisar índices y claves foráneas · **Fase 10** · **Criterio C5**

**Qué:** si al modelar los servicios se detecta una columna que debería tener
índice único o una FK faltante, se agrega aquí.

**Por qué:** el criterio **C5** valora el acceso a datos correcto e indexado.

**Estado:** ⏳ pendiente (se revisa cuando se implementen los repositories).

---

### C-03 — Tablas nuevas por proceso · **Según necesidad** · **Regla R5**

**Qué:** si un subproceso necesita una tabla que no existe en las 26, se documenta aquí.

**Por qué:** el usuario pidió decidir las tablas faltantes **por proceso** y consultar
antes de crearlas (regla R5).

**Estado:** ⏳ pendiente.

---

## 4. CÓMO AGREGAR UN CAMPO A ESTE DOCUMENTO

Cuando se ejecute un cambio real sobre la base de datos:

1. Agregar una fila en la sección **2. CAMBIOS APLICADOS**.
2. Incluir: número correlativo, fecha, qué cambió, el **SQL exacto** ejecutado y el
   **criterio de la rúbrica** que lo justifica.
3. Marcar el estado como `✅ aplicado`.
4. Si el cambio fue una tabla nueva, listarlo también en el **README** (sección de tablas).
