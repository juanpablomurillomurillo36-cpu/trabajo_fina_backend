# CAMBIOS DE LA BASE DE DATOS — vs EVIDENCIA 1

> **Documento obligatorio de la rúbrica** (`database/CAMBIOS.md`).
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
| Índices únicos (sin PK) | 10 |
| Codificación | `utf8mb4_spanish_ci` |

### Estado actual de `discoteca_api` (tras los cambios de la Fase 10)

| Ítem | Antes | Después |
|---|---|---|
| Tablas | 26 | **27** |
| Claves foráneas | 27 | **28** |
| Índices únicos (sin PK) | 10 | **11** |

> Se puede reconstruir la base **desde cero** con:
> `mysql -u root -p < database/01_schema.sql`
> Verificado: la reconstrucción devuelve 27 tablas / 28 FK / 11 índices únicos.

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

### C-01 — Tabla `bitacora` · ✅ aplicado (Fase 10) · **Criterio C8**

**Qué:** tabla que registra **quién hizo qué y cuándo** sobre los registros
importantes (creación, edición, anulación).

**Por qué:** el criterio **C8 (RNF backend)** exige explícitamente **bitácora**.
Complementa la tabla `accesos` (que solo audita *sesiones*: login/logout) con la
auditoría de *datos*: quién creó o anuló una venta, una compra, un rol, un usuario.

**SQL ejecutado:**

```sql
CREATE TABLE bitacora (
  id_bitacora   INT          NOT NULL AUTO_INCREMENT,
  id_usuario    INT          NOT NULL,
  tabla         VARCHAR(64)  NOT NULL COMMENT 'Tabla afectada',
  id_registro   INT          NULL     COMMENT 'Id del registro afectado; sin FK porque apunta a distintas tablas',
  accion        ENUM('CREACION','EDICION','ANULACION') NOT NULL,
  detalle       TEXT         NULL     COMMENT 'Resumen legible del cambio',
  direccion_ip  VARCHAR(45)  NULL     COMMENT 'IPv4 o IPv6 de quien ejecuto la accion',
  fecha_hora    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_bitacora),
  KEY idx_bitacora_usuario (id_usuario),
  KEY idx_bitacora_fecha (fecha_hora),
  KEY idx_bitacora_registro (tabla, id_registro),
  CONSTRAINT fk_bitacora_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
```

**Ajustes respecto al SQL planeado (sección 3) y por qué:**

| Planeado | Ejecutado | Motivo |
|---|---|---|
| `USUARIO_id` | `id_usuario` | Las 26 tablas nombran la FK como `id_<tabla>`, no `TABLA_id` |
| `fecha` | `fecha_hora` | Convención `fecha_<suceso>`; además coincide con `accesos.fecha_hora` |
| PK en línea | `PRIMARY KEY` aparte | Forma estándar del volcado de MySQL |
| — | `idx_bitacora_fecha`, `idx_bitacora_registro` | Consultas típicas: "actividad reciente" y "historial de un registro" (C5) |
| — | `COMMENT` en columnas | La propia base documenta que `id_registro` no tiene FK por ser polimórfico |

**Decisiones de diseño:**
- `ON DELETE RESTRICT`: no se puede borrar un usuario que tenga auditoría.
- Sin `id_registro` con FK: apunta a distintas tablas (polimórfico), por eso lleva
  su propio índice compuesto `(tabla, id_registro)` en vez de clave foránea.
- `accion` solo admite `CREACION/EDICION/ANULACION` porque el esquema trabaja con
  **borrado lógico** (`estado='inactivo'`, `estado='anulada'`): no hay DELETE real.

---

### C-02 — Revisión de índices y claves foráneas · ✅ aplicado (Fase 10) · **Criterio C5**

**Qué:** revisión completa de cobertura de índices.

**Resultados de la revisión:**

| Revisión | Resultado |
|---|---|
| Claves foráneas sin índice | **0 de 27** — todas están indexadas |
| Índices únicos existentes | 10 (antes de la Fase 10) |
| Tablas candidatas a índice único | `categoria_empleado`, `productos`, `servicios`, `categoria_clientes`, `compras`, `evento` |

**SQL ejecutado:**

```sql
ALTER TABLE categoria_empleado
  ADD UNIQUE KEY uq_categoria_empleado_nombre (nombre);
```

**Por qué SOLO `categoria_empleado`:**

- ✅ `categoria_empleado.nombre` es un `ENUM('DJ','mesero','ingreso','administrativo')`
  con solo 4 valores posibles: nunca se quiere una fila `DJ` duplicada. El índice es
  inequívoco y **seguro**.
- ⛔ `productos`, `servicios` y `categoria_clientes` tienen **borrado lógico**
  (`estado='inactivo'`). Un `UNIQUE(nombre)` simple impediría volver a crear un
  registro con un nombre que ya fue desactivado (el índice lo seguiría bloqueando
  porque la fila inactiva sigue existiendo). Su duplicado se controla en la capa de
  **servicio**, con el patrón del ejemplo del profesor (`SELECT 1 AS existe` → `409`),
  que solo compara entre registros **activos**.
- ⛔ `compras` no tiene columna folio/comprobante (solo `ventas` tiene
  `uq_ventas_comprobante`), y `evento` sí debe permitir repetir nombre en fechas
  distintas (ciclo semanal).

**Pendiente futuro:** si se agrega una columna de folio a `compras` o un SKU a
`productos`, revisar aquí su índice único.

---

### C-04 — Usuario de aplicación con mínimo privilegio · ✅ aplicado (Fase 10) · **Criterio C8**

**Qué:** se creó el usuario MySQL que usa la API para conectarse, en lugar de
conectar como `root`. Archivo: `database/02_usuario_app.sql` (`npm run db:user`).

**Por qué:** principio de mínimo privilegio. `root` puede borrar bases enteras;
la aplicación solo necesita DML.

**SQL ejecutado (resumen):**

```sql
CREATE USER IF NOT EXISTS 'discoteca_app'@'localhost' IDENTIFIED BY 'DiscotecaApp2026';
ALTER USER 'discoteca_app'@'localhost' IDENTIFIED BY 'DiscotecaApp2026';
GRANT SELECT, INSERT, UPDATE, DELETE ON discoteca_api.* TO 'discoteca_app'@'localhost';
FLUSH PRIVILEGES;
```

**Verificación realizada:**

| Prueba | Resultado |
|---|---|
| `CREATE TABLE` como `discoteca_app` | ❌ denegado (ERROR 1142) — correcto |
| `INSERT` en `bitacora` | ✅ concedido (falló solo por clave foránea, no por permiso) |
| Arranque de la API con este usuario | ✅ `GET /api/salud` → 200 |
| Privilegios sobrantes detectados | Se revocó un grant colgante `ALL ON discoteca.*` (esa base no existe) |

**Archivos tocados:** `database/02_usuario_app.sql` (nuevo), `.env` y
`.env.example` ahora apuntan a `discoteca_app`.

---

### C-05 — Tabla `codigos_recuperacion` · ✅ aplicado (Fase 21) · **Criterio C7**

**Qué:** tabla que guarda los códigos de recuperación de contraseña
(olvidé mi contraseña). Cada código se guarda **hasheado con bcrypt**,
con expiración de 15 minutos, tope de 5 intentos y marca de uso.

**Por qué:** el criterio **C7 (autenticación y autorización)** incluye el
flujo de recuperación de contraseña. La tabla `notificaciones` no sirve
para esto: su FK apunta a `clientes`, no a `usuarios`. Y guardar el código
en claro violaría la misma regla que la contraseña: con el volcado de la
base, un código en claro equivale a una cuenta robada.

**SQL ejecutado:**

```sql
CREATE TABLE codigos_recuperacion (
  id_codigo        INT          NOT NULL AUTO_INCREMENT,
  id_usuario       INT          NOT NULL,
  codigo_hash      VARCHAR(255) NOT NULL COMMENT 'bcrypt del codigo de 6 digitos; jamas el codigo en claro',
  fecha_expiracion DATETIME     NOT NULL COMMENT 'Vida util del codigo (15 minutos)',
  intentos         INT          NOT NULL DEFAULT 0 COMMENT 'Intentos de verificacion; el tope (5) se aplica en la API',
  usado            TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = ya se intercambio por una contrasena nueva',
  fecha_creacion   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_codigo),
  KEY fk_codigo_usuario (id_usuario),
  CONSTRAINT fk_codigo_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
```

**Decisiones de diseño:**

| Decisión | Motivo |
|---|---|
| `codigo_hash` (bcrypt) | El código es una credencial temporal: mismo trato que la contraseña |
| `fecha_expiracion` (15 min) | Ventana corta: un código robado caduca rápido |
| `intentos` (tope 5 en la API) | 6 dígitos = 10⁶ combinaciones; 5 intentos por código hacen el fuerza bruta inviable |
| `usado` | Un código sirve UNA sola vez; tras restablecer queda inservible |
| `ON DELETE CASCADE` | Al borrar la cuenta, sus códigos mueren con ella (son desechables; a diferencia de `bitacora`, no aportan auditoría que deba conservarse) |
| Índice solo en `id_usuario` | La consulta típica es "código activo de este usuario" |

**Estado actual de `discoteca_api` (tras esta tabla):** 28 tablas,
29 claves foráneas.

---

## 3. CAMBIOS PLANEADOS (se ejecutarán en su fase)

### C-01 — Crear tabla `bitacora` · **Fase 10** · **Criterio C8**

**Estado:** ✅ **aplicado** — ver sección 2 (con los ajustes de convención explicados).

---

### C-02 — Revisar índices y claves foráneas · **Fase 10** · **Criterio C5**

**Estado:** ✅ **aplicado** — ver sección 2 (27/27 FK indexadas + `uq_categoria_empleado_nombre`).

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
5. Regenerar `database/01_schema.sql` si el cambio fue de esquema:
   ```
   mysqldump -u root -p --no-data --databases discoteca_api --set-gtid-purged=OFF --skip-dump-date > database/01_schema.sql
   ```
