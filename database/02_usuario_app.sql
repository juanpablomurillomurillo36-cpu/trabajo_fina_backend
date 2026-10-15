-- =====================================================================
-- database/02_usuario_app.sql
-- ---------------------------------------------------------------------
-- Crea el USUARIO DE APLICACION que usa la API para conectarse a MySQL.
--
-- POR QUE NO CONECTAR COMO root?
--   Principio de minimo privilegio. root puede borrar bases enteras;
--   la aplicacion solo necesita leer, escribir y actualizar filas.
--   Si un dia alguien logra inyectar SQL, con este usuario no podra
--   borrar tablas ni crear usuarios nuevos.
--
--   root        -> solo para administrar (este archivo, los volcados)
--   discoteca_app-> lo que usa la API diariamente (.env)
--
-- COMO EJECUTARLO (requiere permisos de root):
--   mysql -u root -p < database/02_usuario_app.sql
--   o: npm run db:user
--
-- Idempotente: se puede ejecutar varias veces sin romper nada.
-- =====================================================================

-- 1) Crear el usuario si aun no existe.
CREATE USER IF NOT EXISTS 'discoteca_app'@'localhost'
  IDENTIFIED BY 'DiscotecaApp2026';

-- 2) Asegurar que la clave sea exactamente la declarada arriba.
--    (CREATE USER IF NOT EXISTS no actualiza la clave si el usuario
--     ya existia; con ALTER USER el script siempre deja todo listo.)
ALTER USER 'discoteca_app'@'localhost'
  IDENTIFIED BY 'DiscotecaApp2026';

-- 3) Permisos: solo DML sobre las tablas de la base de la API.
--    SELECT  -> listar, buscar, validar existencias
--    INSERT  -> crear registros y escribir la bitacora
--    UPDATE  -> editar y cambiar estados (confirmada, pagada...)
--    DELETE  -> necesario para quitar filas de tablas puente como
--               rol_permiso (quitar un permiso a un rol)
--
--    NO se otorgan CREATE, DROP, ALTER ni GRANT: la aplicacion no
--    debe poder modificar el esquema en tiempo de ejecucion.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON discoteca_api.*
  TO 'discoteca_app'@'localhost';

-- 4) Aplicar los cambios de privilegios de inmediato.
FLUSH PRIVILEGES;
