# Pruebas manuales con Postman — discoteca-api

Arrancar el servidor antes de empezar:

```bash
npm run dev
```

Base: `http://localhost:3000`

---

## Cómo configurar cada petición

| Pestaña | Qué hacer |
|---|---|
| **Params** | Nada. Déjala vacía. |
| **Authorization** | Nada. Déjalo en `No Auth`. |
| **Headers** | Nada. Postman pone `Content-Type: application/json` solo, cuando eliges Body → raw → JSON. |
| **Body** | Aquí se pega el JSON: **raw** → **JSON**. En GET y DELETE: **none**. |
| **Scripts** | Nada. |
| **Settings** | Nada. |

**Dos reglas de la URL**

1. Una sola barra: `http://localhost:3000/api/permisos`. Si queda `//api/permisos` la API responde **404 `RUTA_NO_ENCONTRADA`**.
2. Donde aparezca `{ID_...}` pega el valor de `datos.id` de la respuesta anterior.

**Secuencia:** los 22 primeros en orden. Después, los negativos.

---

# 1. PERMISOS (6 peticiones)

### 1 — `GET /api/permisos` → 200

```
http://localhost:3000/api/permisos
```

Body: **none**

Guarda de la respuesta `datos[0].id` y `datos[1].id` → son los `{ID_PERMISO_A}` y `{ID_PERMISO_B}` de más adelante.

---

### 2 — `POST /api/permisos` → 201 + `Location`

```
http://localhost:3000/api/permisos
```

```json
{
  "nombrePermiso": "prueba.postman",
  "descripcion": "Permiso de prueba",
  "estado": "activo"
}
```

Guarda `datos.id` → `{ID_PERMISO}`.

---

### 3 — `PUT /api/permisos/{ID_PERMISO}` → 200

```
http://localhost:3000/api/permisos/57
```

```json
{
  "descripcion": "Descripcion editada"
}
```

---

### 4 — `GET /api/permisos/{ID_PERMISO}` → 200

```
http://localhost:3000/api/permisos/57
```

Body: **none**

---

### 5 — `PATCH /api/permisos/{ID_PERMISO}/estado` → 200

```
http://localhost:3000/api/permisos/{ID_PERMISO}/estado
```

```json
{
  "estado": "inactivo"
}
```

---

### 6 — `DELETE /api/permisos/{ID_PERMISO}` → 200

```
http://localhost:3000/api/permisos/{ID_PERMISO}
```

Body: **none**

---

# 2. ROLES (10 peticiones)

### 7 — `GET /api/roles` → 200

```
http://localhost:3000/api/roles
```

Body: **none**

Busca el cuyo `nombreRol` sea `"administrador"` (su id es el **5**) → es tu `{ID_ROL_ADMIN}`.

---

### 8 — `POST /api/roles` → 201 + `Location`

```
http://localhost:3000/api/roles
```

```json
{
  "nombreRol": "rol.prueba",
  "descripcion": "Rol de prueba",
  "estado": "activo"
}
```

Guarda `datos.id` → `{ID_ROL}`.

---

### 9 — `PUT /api/roles/{ID_ROL}` → 200

```
http://localhost:3000/api/roles/{ID_ROL}
```

```json
{
  "descripcion": "Rol editado"
}
```

---

### 10 — `GET /api/roles/{ID_ROL}` → 200

```
http://localhost:3000/api/roles/{ID_ROL}
```

Body: **none**

La respuesta debe traer `"permisos": []`.

---

### 11 — `PATCH /api/roles/{ID_ROL}/estado` → 200

```
http://localhost:3000/api/roles/{ID_ROL}/estado
```

```json
{
  "estado": "inactivo"
}
```

---

### 12 — `POST /api/roles/{ID_ROL}/permisos` → 200

```
http://localhost:3000/api/roles/{ID_ROL}/permisos
```

```json
{
  "idPermiso": 23
}
```

Usa `{ID_PERMISO_A}` del paso 1. `datos.totalPermisos` debe ser ≥ 1.
El rol está inactivo y aun así debe responder **200**.

---

### 13 — `POST /api/roles/{ID_ROL}/permisos` → 200

```
http://localhost:3000/api/roles/{ID_ROL}/permisos
```

```json
{
  "idPermiso": 24
}
```

Usa `{ID_PERMISO_B}` del paso 1. `datos.totalPermisos` debe ser ≥ 2.

---

### 14 — `DELETE /api/roles/{ID_ROL}/permisos/{ID_PERMISO_A}` → 200

```
http://localhost:3000/api/roles/{ID_ROL}/permisos/{ID_PERMISO_A}
```

Body: **none**

`datos` debe venir como **arreglo** de los permisos que quedaron.

---

### 15 — `DELETE /api/roles/{ID_ROL}/permisos/{ID_PERMISO_B}` → **409**

```
http://localhost:3000/api/roles/{ID_ROL}/permisos/{ID_PERMISO_B}
```

Body: **none**

Es el último: un rol no puede quedar sin permisos.

---

### 16 — `DELETE /api/roles/{ID_ROL}` → 200

```
http://localhost:3000/api/roles/{ID_ROL}
```

Body: **none**

---

# 3. USUARIOS (6 peticiones)

### 17 — `GET /api/usuarios` → 200

```
http://localhost:3000/api/usuarios
```

Body: **none**

Ningún item debe traer `contrasenaHash`.

---

### 18 — `POST /api/usuarios` → 201 + `Location`

```
http://localhost:3000/api/usuarios
```

```json
{
  "nombre": "Prueba",
  "apellido": "Postman",
  "email": "prueba.postman@correo.com",
  "contrasena": "Clave1234",
  "telefono": "3000000000",
  "idRol": 5,
  "estado": "activo"
}
```

- `idRol` = `{ID_ROL_ADMIN}` (5 en la semilla)
- `contrasena`: mínimo 8 caracteres, con letra y número
- `email` único

Guarda `datos.id` → `{ID_USUARIO}`.

---

### 19 — `GET /api/usuarios/{ID_USUARIO}` → 200

```
http://localhost:3000/api/usuarios/{ID_USUARIO}
```

Body: **none**

---

### 20 — `PUT /api/usuarios/{ID_USUARIO}` → 200

```
http://localhost:3000/api/usuarios/{ID_USUARIO}
```

```json
{
  "telefono": "3001112233"
}
```

Solo cambia el teléfono: `nombre`, `apellido` y `email` deben seguir iguales.

---

### 21 — `PATCH /api/usuarios/{ID_USUARIO}/estado` → 200

```
http://localhost:3000/api/usuarios/{ID_USUARIO}/estado
```

```json
{
  "estado": "inactivo"
}
```

---

### 22 — `DELETE /api/usuarios/{ID_USUARIO}` → 200

```
http://localhost:3000/api/usuarios/{ID_USUARIO}
```

Body: **none**

---

# 4. CASOS NEGATIVOS

### N1 — `GET /api/roles/abc` → **400** `VALIDACION`

```
http://localhost:3000/api/roles/abc
```

Body: **none**

---

### N2 — `GET /api/roles/99999` → **404** `NO_ENCONTRADO`

```
http://localhost:3000/api/roles/99999
```

Body: **none**

---

### N3 — `POST /api/roles` duplicado → **409** `CONFLICTO`

```
http://localhost:3000/api/roles
```

```json
{
  "nombreRol": "administrador",
  "descripcion": "ya existe"
}
```

---

### N4 — `POST /api/roles` cuerpo vacío → **400** `CUERPO_INVALIDO`

```
http://localhost:3000/api/roles
```

```json
{}
```

---

### N5 — `PUT /api/roles/{ID_ROL_ADMIN}` sin campos → **400** `CUERPO_INVALIDO`

```
http://localhost:3000/api/roles/5
```

```json
{}
```

---

### N6 — `POST /api/roles/{ID_ROL_ADMIN}/permisos` repetido → **409** `CONFLICTO`

```
http://localhost:3000/api/roles/5/permisos
```

```json
{
  "idPermiso": 23
}
```

Repite el mismo `idPermiso` dos veces seguidas.

---

### N7 — `POST /api/usuarios` contraseña débil → **400** `VALIDACION`

```
http://localhost:3000/api/usuarios
```

```json
{
  "nombre": "Clave",
  "apellido": "Debil",
  "email": "debil@correo.com",
  "contrasena": "123",
  "idRol": 5
}
```

`error.detalles[0].campo` debe ser `contrasena`.

---

### N8 — `POST /api/usuarios` con `idRol` inexistente → **400** `VALIDACION`

```
http://localhost:3000/api/usuarios
```

```json
{
  "nombre": "Sin",
  "apellido": "Rol",
  "email": "sinrol@correo.com",
  "contrasena": "Clave1234",
  "idRol": 99999
}
```

`error.detalles[0].campo` debe ser `idRol`.

---

### N9 — `POST /api/usuarios` con email repetido → **409** `CONFLICTO`

```
http://localhost:3000/api/usuarios
```

```json
{
  "nombre": "Correo",
  "apellido": "Repetido",
  "email": "admin@correo.mx",
  "contrasena": "Clave1234",
  "idRol": 5
}
```

---

### N10 — `DELETE /api/roles/5` → **409** `LLAVE_FORANEA`

```
http://localhost:3000/api/roles/5
```

Body: **none**

El rol `administrador` tiene usuarios, no se puede borrar.

---

### N11 — `POST /api/no/existe` → **404** `RUTA_NO_ENCONTRADA`

```
http://localhost:3000/api/no/existe
```

```json
{
  "x": 1
}
```

---

## Si algo da 409 y no debería

Significa que un nombre/correo ya existe de una corrida anterior. Cambia el número:

- `nombrePermiso`: `prueba.postman` → `prueba.postman2`
- `nombreRol`: `rol.prueba` → `rol.prueba2`
- `email`: `prueba.postman@correo.com` → `prueba.postman2@correo.com`
