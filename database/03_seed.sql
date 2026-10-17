-- =====================================================================
-- database/03_seed.sql
-- ---------------------------------------------------------------------
-- DATOS DE EJEMPLO de la Evidencia 2 (fase 49 · criterios C1 y C2).
--
-- Qué hace:
--   1. VACIA todas las tablas en orden de dependencias (borrado seguro
--      con FOREIGN_KEY_CHECKS=0) para que el script sirva tanto en una
--      base recien creada (01_schema.sql) como en una ya usada.
--   2. Llena TODO con IDS FIJOS... NO: los ids NO se fijan; los asigna
--      AUTO_INCREMENT. En Postman los ids se capturan de las respuestas
--      (create -> test guarda el id -> siguiente request).
--
-- Los datos son COHERENTES con:
--   - la UML de la fase 51 (escenario de transaccion: venta -> detalle
--     -> producto -> cliente; escenario de seguridad: usuario -> rol ->
--     permisos);
--   - la coleccion Postman de la fase 50 (login con admin@correo.mx);
--   - los reportes de las fases 45-48 (hay ventas pagadas en 3 meses
--     distintos, eventos finalizados con asistencia, productos con
--     stock bajo y un cliente que cumple anos HOY para /cumpleanos).
--
-- Credenciales fijas (hash bcrypt embebidos):
--   admin@correo.mx      / Admin1234     (rol administrador, 19 permisos)
--   empleado@correo.mx   / Empleado1234  (rol empleado, subconjunto)
--   cliente@correo.mx    / Cliente1234   (rol cliente)
--
-- Uso:
--   npm run db:seed
--   mysql -u root -p discoteca_api < database/03_seed.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. VACIADO (orden legible de hojas a raices; con las FK desactivadas
--    el orden tecnico no importa, pero se deja el Jerarquico para que
--    se entienda al leerlo).
-- ---------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM accesos;
DELETE FROM bitacora;
DELETE FROM codigos_recuperacion;
DELETE FROM notificaciones;
DELETE FROM programa_puntos;
DELETE FROM ingresos;
DELETE FROM detalle_ventas;
DELETE FROM ventas;
DELETE FROM detalle_reserva;
DELETE FROM reservas;
DELETE FROM agenda_eventos;
DELETE FROM ficha_servicio;
DELETE FROM ficha_tecnica;
DELETE FROM evento;
DELETE FROM agenda_empleados;
DELETE FROM servicios;
DELETE FROM empleados;
DELETE FROM categoria_empleado;
DELETE FROM detalle_compras;
DELETE FROM compras;
DELETE FROM productos;
DELETE FROM proveedores;
DELETE FROM clientes;
DELETE FROM categoria_clientes;
DELETE FROM rol_permiso;
DELETE FROM usuarios;
DELETE FROM permisos;
DELETE FROM roles;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 2. SEGURIDAD (escenario UML: usuario -> rol -> permisos)
-- ---------------------------------------------------------------------
INSERT INTO roles (nombre_rol, descripcion, estado) VALUES
  ('administrador', 'Acceso total a todos los modulos', 'activo'),
  ('cliente',       'Acceso de cliente a su cuenta',    'activo'),
  ('empleado',      'Operacion del dia a dia del local','activo');

-- Los 19 permisos exactos que exige la razon de ser del proyecto.
INSERT INTO permisos (nombre_permiso, descripcion, estado) VALUES
  ('ventas.registrar',        'Registrar ventas',                'activo'),
  ('ventas.anular',           'Anular ventas',                   'activo'),
  ('usuarios.gestionar',      'Gestionar usuarios',              'activo'),
  ('roles.gestionar',         'Gestionar roles',                 'activo'),
  ('permisos.gestionar',      'Gestionar permisos',              'activo'),
  ('bitacora.consultar',      'Consultar bitacora',              'activo'),
  ('proveedores.gestionar',   'Gestionar proveedores',           'activo'),
  ('productos.gestionar',     'Gestionar productos',             'activo'),
  ('servicios.gestionar',     'Gestionar servicios',             'activo'),
  ('categorias.gestionar',    'Gestionar categorias',            'activo'),
  ('empleados.gestionar',     'Gestionar empleados y agenda',    'activo'),
  ('clientes.gestionar',      'Gestionar clientes y puntos',     'activo'),
  ('compras.gestionar',       'Gestionar compras e inventario',  'activo'),
  ('reservas.gestionar',      'Gestionar reservas VIP/mesas',    'activo'),
  ('ingresos.gestionar',      'Validar ingresos y aforo',        'activo'),
  ('eventos.gestionar',       'Gestionar eventos y agenda',      'activo'),
  ('ventas.gestionar',        'Gestionar el modulo de ventas',   'activo'),
  ('reportes.consultar',      'Consultar reportes',              'activo'),
  ('notificaciones.gestionar','Gestionar notificaciones',        'activo');

-- Administrador: TODOS los permisos.
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
  FROM roles r
  CROSS JOIN permisos p
 WHERE r.nombre_rol = 'administrador';

-- Empleado: subconjunto de operacion (nada de seguridad ni de baja de
-- ventas; el admin conserva lo destructivo).
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
  FROM roles r
  JOIN permisos p
    ON p.nombre_permiso IN (
      'ventas.registrar',
      'reservas.gestionar',
      'ingresos.gestionar',
      'clientes.gestionar',
      'eventos.gestionar',
      'reportes.consultar',
      'notificaciones.gestionar',
      'servicios.gestionar',
      'categorias.gestionar'
    )
 WHERE r.nombre_rol = 'empleado';

-- Cliente: sin permisos de gestion (solo usa su cuenta con JWT).
-- (No se insertan filas en rol_permiso para el rol cliente.)

-- Usuarios con contrasenas fijas (bcrypt de los valores de arriba).
INSERT INTO usuarios (id_rol, nombre, apellido, email, contrasena_hash, telefono, estado)
SELECT r.id_rol, 'Ana', 'Admin', 'admin@correo.mx',
       '$2b$10$jkGb7X4bRWeO4u2tYdf7YeSDM6dJlFbjHmlNfLNK23CLSbTARk1Sq',
       '3001112233', 'activo'
  FROM roles r WHERE r.nombre_rol = 'administrador';

INSERT INTO usuarios (id_rol, nombre, apellido, email, contrasena_hash, telefono, estado)
SELECT r.id_rol, 'Diego', 'Rivas', 'empleado@correo.mx',
       '$2b$10$qh4Yj/RjJiNpO3isMPNt5e93YrA1v435QePKD1YAD89DuTKFbDxta',
       '3004445566', 'activo'
  FROM roles r WHERE r.nombre_rol = 'empleado';

INSERT INTO usuarios (id_rol, nombre, apellido, email, contrasena_hash, telefono, estado)
SELECT r.id_rol, 'Lucia', 'Mendoza', 'cliente@correo.mx',
       '$2b$10$RKgQ1efJe0T3BJhOp4Kz7OOixLTnXEX.JFF/G6QXg0WVPs4XBEaOq',
       '3007778899', 'activo'
  FROM roles r WHERE r.nombre_rol = 'cliente';

-- ---------------------------------------------------------------------
-- 3. CATALOGOS DE PERSONAS Y COMERCIO
-- ---------------------------------------------------------------------
INSERT INTO categoria_clientes (nombre, descripcion, estado) VALUES
  ('VIP',     'Mesa reservada y descuentos del 10%', 'activo'),
  ('General', 'Publico general del local',           'activo');

INSERT INTO categoria_empleado (nombre, descripcion, estado) VALUES
  ('DJ',            'Encargado de la musica',        'activo'),
  ('mesero',        'Servicio de mesas y barra',     'activo'),
  ('ingreso',       'Control de puerta y aforo',     'activo'),
  ('administrativo','Gestion administrativa',        'activo');

INSERT INTO empleados (id_categoria_empleado, nombre, apellido, documento, telefono, email, estado)
SELECT c.id_categoria_empleado, 'Paula', 'Diaz',  'EMP-2001', '3111111111', 'paula@correo.mx', 'activo'
  FROM categoria_empleado c WHERE c.nombre = 'DJ';

INSERT INTO empleados (id_categoria_empleado, nombre, apellido, documento, telefono, email, estado)
SELECT c.id_categoria_empleado, 'Hugo', 'Soto',   'EMP-2002', '3222222222', 'hugo@correo.mx', 'activo'
  FROM categoria_empleado c WHERE c.nombre = 'mesero';

INSERT INTO empleados (id_categoria_empleado, nombre, apellido, documento, telefono, email, estado)
SELECT c.id_categoria_empleado, 'Rosa', 'Vega',   'EMP-2003', '3333333333', 'rosa@correo.mx', 'activo'
  FROM categoria_empleado c WHERE c.nombre = 'ingreso';

INSERT INTO empleados (id_categoria_empleado, nombre, apellido, documento, telefono, email, estado)
SELECT c.id_categoria_empleado, 'Ivan', 'Pardo',  'EMP-2004', '3444444444', 'ivan@correo.mx', 'activo'
  FROM categoria_empleado c WHERE c.nombre = 'administrativo';

INSERT INTO proveedores (nombre, nit, telefono, email, direccion, estado) VALUES
  ('Distribuidora Andina',  '900111222-1', '6015551111', 'ventas@andina.co',  'Calle 10 # 20-30',   'activo'),
  ('Bebidas del Norte',     '900333444-2', '6015552222', 'pedidos@norte.co',  'Carrera 15 # 40-50', 'activo'),
  ('Snacks Total',          '900555666-3', '6015553333', 'hola@snackstotal.co','Zona Industrial',    'activo');

INSERT INTO productos (nombre, descripcion, precio_venta, stock_actual, stock_minimo, stock_maximo, estado) VALUES
  ('Cerveza artesanal 330ml', 'Cerveza local en botella',     8000.00,   40, 10, 100, 'activo'),
  ('Vodka premium 700ml',     'Destilado importado',        120000.00,    3,  5,  50, 'activo'),
  ('Gaseosa 355ml',           'Bebida sin alcohol',           4000.00,  100, 20, 200, 'activo'),
  ('Agua mineral 600ml',      'Agua pura embotellada',        3500.00,   60, 15, 120, 'activo'),
  ('Mix de snacks',           'Papas y frutos secos',        15000.00,    0,  5,  40, 'activo'),
  ('Refresco antiguo',        'Producto fuera de catalogo',   3000.00,   25,  5,  50, 'inactivo');

INSERT INTO servicios (nombre, descripcion, precio, estado) VALUES
  ('Mesa VIP',          'Mesa reservada con botellero', 350000.00, 'activo'),
  ('Barra libre 2h',    'Bebidas de la casa 2 horas',    50000.00, 'activo'),
  ('Pista privada',     'Area exclusiva del grupo',     200000.00, 'activo'),
  ('DJ privado',        'Sesion exclusiva del DJ',      150000.00, 'activo'),
  ('Servicio camareros','Camareros dedicados a la mesa', 80000.00, 'activo'),
  ('Cocteleria especial','Declaratoria fuera de catalogo',60000.00,'inactivo');

-- ---------------------------------------------------------------------
-- 4. CLIENTES (UML escenario de transaccion) Y PUNTOS
-- ---------------------------------------------------------------------
INSERT INTO clientes
  (id_categoria_cliente, nombre, apellido, documento, telefono, email, fecha_nacimiento, es_vip, estado)
SELECT c.id_categoria_cliente, 'Carlos', 'Gomez',  'CC-100100', '3001231234', 'carlos@correo.mx',
       -- Cumple anos HOY: alimenta POST /api/notificaciones/cumpleanos
       DATE_ADD(CURDATE(), INTERVAL -28 YEAR), 1, 'activo'
  FROM categoria_clientes c WHERE c.nombre = 'VIP';

INSERT INTO clientes
  (id_categoria_cliente, nombre, apellido, documento, telefono, email, fecha_nacimiento, es_vip, estado)
SELECT c.id_categoria_cliente, 'Maria', 'Lopez',   'CC-100200', '3002342345', 'maria@correo.mx',
       '1995-06-15', 1, 'activo'
  FROM categoria_clientes c WHERE c.nombre = 'VIP';

INSERT INTO clientes
  (id_categoria_cliente, nombre, apellido, documento, telefono, email, fecha_nacimiento, es_vip, estado)
SELECT c.id_categoria_cliente, 'Jorge', 'Ruiz',    'CC-100300', '3003453456', 'jorge@correo.mx',
       '1990-03-22', 0, 'activo'
  FROM categoria_clientes c WHERE c.nombre = 'General';

INSERT INTO clientes
  (id_categoria_cliente, nombre, apellido, documento, telefono, email, fecha_nacimiento, es_vip, estado)
SELECT c.id_categoria_cliente, 'Ana', 'Torres',    'CC-100400', '3004564567', 'anatorres@correo.mx',
       '2000-11-02', 0, 'activo'
  FROM categoria_clientes c WHERE c.nombre = 'General';

INSERT INTO clientes
  (id_categoria_cliente, nombre, apellido, documento, telefono, email, fecha_nacimiento, es_vip, estado)
SELECT c.id_categoria_cliente, 'Pedro', 'Sanz',    'CC-100500', '3005675678', 'pedro@correo.mx',
       '1988-09-30', 0, 'activo'
  FROM categoria_clientes c WHERE c.nombre = 'General';

INSERT INTO clientes
  (id_categoria_cliente, nombre, apellido, documento, telefono, email, fecha_nacimiento, es_vip, estado)
SELECT c.id_categoria_cliente, 'Ines', 'Lara',     'CC-100600', '3006786789', 'ines@correo.mx',
       NULL, 1, 'inactivo'
  FROM categoria_clientes c WHERE c.nombre = 'VIP';

-- ---------------------------------------------------------------------
-- 5. COMPRAS (RN-01) CON DETALLE
--    subtotal de detalle es GENERADO: NUNCA se inserta.
-- ---------------------------------------------------------------------
INSERT INTO compras (id_proveedor, fecha_compra, total, estado)
SELECT p.id_proveedor, DATE_SUB(NOW(), INTERVAL 30 DAY), 269000.00, 'confirmada'
  FROM proveedores p WHERE p.nombre = 'Distribuidora Andina';

INSERT INTO compras (id_proveedor, fecha_compra, total, estado)
SELECT p.id_proveedor, DATE_SUB(NOW(), INTERVAL 5 DAY), 540000.00, 'pendiente'
  FROM proveedores p WHERE p.nombre = 'Bebidas del Norte';

-- Compra 1 confirmada: cervezas y gaseosas.
INSERT INTO detalle_compras (id_compra, id_producto, cantidad, precio_unitario)
SELECT c.id_compra, p.id_producto, 24, 6000.00
  FROM compras c
  JOIN productos p ON p.nombre = 'Cerveza artesanal 330ml'
 WHERE c.estado = 'confirmada';

INSERT INTO detalle_compras (id_compra, id_producto, cantidad, precio_unitario)
SELECT c.id_compra, p.id_producto, 50, 2500.00
  FROM compras c
  JOIN productos p ON p.nombre = 'Gaseosa 355ml'
 WHERE c.estado = 'confirmada';

-- Compra 2 pendiente: vodka.
INSERT INTO detalle_compras (id_compra, id_producto, cantidad, precio_unitario)
SELECT c.id_compra, p.id_producto, 6, 90000.00
  FROM compras c
  JOIN productos p ON p.nombre = 'Vodka premium 700ml'
 WHERE c.estado = 'pendiente';

-- ---------------------------------------------------------------------
-- 6. EVENTOS + FICHA TECNICA (1:1) + SERVICIOS DE LA FICHA (N:N)
--    2 tematicos y 2 fiestas privadas -> comparativo RF-DES-10.
--    Dos de ellos ya pasaron (finalizados) para poder medir asistencia.
-- ---------------------------------------------------------------------
INSERT INTO evento (nombre, tematica, tipo_evento, fecha, hora_inicio, hora_fin, estado) VALUES
  ('Noche Neon',      'Años 90 en neón',        'tematico',       DATE_SUB(CURDATE(), INTERVAL 20 DAY), '20:00', '02:00', 'finalizado'),
  ('Fiesta 80s',      'Ochentas y synthwave',   'tematico',       DATE_ADD(CURDATE(), INTERVAL 7 DAY),  '21:00', '03:00', 'programado'),
  ('Boda Gomez',      'Blanco y oro',           'fiesta_privada', DATE_SUB(CURDATE(), INTERVAL 10 DAY), '18:00', '23:00', 'finalizado'),
  ('XV de Camila',    'Princesa y panal',       'fiesta_privada', DATE_ADD(CURDATE(), INTERVAL 14 DAY), '17:00', '23:00', 'programado');

-- Ficha tecnica 1:1 (uq_ficha_evento): solo en los dos primeros.
INSERT INTO ficha_tecnica (id_evento, tematica, franja_horaria, cantidad_invitados, observaciones)
SELECT e.id_evento, 'Años 90 en neón', '20:00 - 02:00', 150, 'Decoracion con tubos de neón y luces UV'
  FROM evento e WHERE e.nombre = 'Noche Neon';

INSERT INTO ficha_tecnica (id_evento, tematica, franja_horaria, cantidad_invitados, observaciones)
SELECT e.id_evento, 'Blanco y oro', '18:00 - 23:00', 80, 'Cena formal + zona de fotografias'
  FROM evento e WHERE e.nombre = 'Boda Gomez';

-- Servicios N:N de cada ficha (cantidad_requerida).
INSERT INTO ficha_servicio (id_ficha_tecnica, id_servicio, cantidad_requerida)
SELECT f.id_ficha_tecnica, s.id_servicio, 2
  FROM ficha_tecnica f
  JOIN evento e ON e.id_evento = f.id_evento AND e.nombre = 'Noche Neon'
  JOIN servicios s ON s.nombre IN ('DJ privado', 'Barra libre 2h');

INSERT INTO ficha_servicio (id_ficha_tecnica, id_servicio, cantidad_requerida)
SELECT f.id_ficha_tecnica, s.id_servicio, 4
  FROM ficha_tecnica f
  JOIN evento e ON e.id_evento = f.id_evento AND e.nombre = 'Boda Gomez'
  JOIN servicios s ON s.nombre IN ('Mesa VIP', 'Servicio camareros');

-- ---------------------------------------------------------------------
-- 7. AGENDA DE EVENTOS (RN-08) Y AGENDA DE EMPLEADOS (turnos)
-- ---------------------------------------------------------------------
INSERT INTO agenda_eventos (id_evento, fecha, hora, descripcion, estado)
SELECT e.id_evento, DATE_ADD(CURDATE(), INTERVAL 7 DAY), '18:00',
       'Montaje de decoracion y prueba de sonido', 'programada'
  FROM evento e WHERE e.nombre = 'Fiesta 80s';

INSERT INTO agenda_eventos (id_evento, fecha, hora, descripcion, estado)
SELECT e.id_evento, DATE_SUB(CURDATE(), INTERVAL 21 DAY), '16:00',
       'Desmontaje y limpieza del local', 'completada'
  FROM evento e WHERE e.nombre = 'Noche Neon';

-- Turno de DJ asignado al evento futuro (XOR: id_evento NO id_servicio).
-- hora_fin > hora_inicio para que el turno sea valido tambien si se
-- edita luego por la API (regla de la fase 32).
INSERT INTO agenda_empleados (id_empleado, id_servicio, id_evento, fecha, hora_inicio, hora_fin, estado)
SELECT emp.id_empleado, NULL, e.id_evento, DATE_ADD(CURDATE(), INTERVAL 7 DAY), '21:00', '23:30', 'programada'
  FROM empleados emp
  JOIN categoria_empleado c ON c.id_categoria_empleado = emp.id_categoria_empleado AND c.nombre = 'DJ'
  JOIN evento e ON e.nombre = 'Fiesta 80s';

-- Turno de mesero en servicio (XOR: id_servicio NO id_evento).
INSERT INTO agenda_empleados (id_empleado, id_servicio, id_evento, fecha, hora_inicio, hora_fin, estado)
SELECT emp.id_empleado, s.id_servicio, NULL, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '18:00', '23:00', 'programada'
  FROM empleados emp
  JOIN categoria_empleado c ON c.id_categoria_empleado = emp.id_categoria_empleado AND c.nombre = 'mesero'
  JOIN servicios s ON s.nombre = 'Mesa VIP';

-- ---------------------------------------------------------------------
-- 8. RESERVAS (RN-02 / RN-04) CON DETALLE
--    subtotal = suma de lineas (base SIN descuento); descuento del 10%
--    solo en la reserva con 3+ detalles, igual que la API.
--    subtotal de detalle_reserva es GENERADO: NUNCA se inserta.
-- ---------------------------------------------------------------------
INSERT INTO reservas
  (id_cliente, tipo_espacio, identificador_espacio, fecha, hora, descuento, subtotal, estado, codigo_qr)
SELECT cl.id_cliente, 'vip', 'VIP-1', DATE_ADD(CURDATE(), INTERVAL 3 DAY), '21:00',
       55000.00, 550000.00, 'confirmada', 'RSV-SEED00000000000001'
  FROM clientes cl WHERE cl.documento = 'CC-100100';

INSERT INTO reservas
  (id_cliente, tipo_espacio, identificador_espacio, fecha, hora, descuento, subtotal, estado, codigo_qr)
SELECT cl.id_cliente, 'mesa', 'MESA-5', DATE_ADD(CURDATE(), INTERVAL 1 DAY), '20:00',
       0.00, 50000.00, 'pendiente', NULL
  FROM clientes cl WHERE cl.documento = 'CC-100300';

INSERT INTO reservas
  (id_cliente, tipo_espacio, identificador_espacio, fecha, hora, descuento, subtotal, estado, codigo_qr)
SELECT cl.id_cliente, 'vip', 'VIP-2', DATE_SUB(CURDATE(), INTERVAL 5 DAY), '22:00',
       0.00, 350000.00, 'cancelada', NULL
  FROM clientes cl WHERE cl.documento = 'CC-100200';

-- Detalle de la reserva confirmada: 3 lineas (base 550000 -> 10% dto).
INSERT INTO detalle_reserva (id_reserva, id_servicio, cantidad, precio_unitario)
SELECT r.id_reserva, s.id_servicio, 1, s.precio
  FROM reservas r
  JOIN servicios s ON s.nombre = 'Mesa VIP'
 WHERE r.estado = 'confirmada';

INSERT INTO detalle_reserva (id_reserva, id_servicio, cantidad, precio_unitario)
SELECT r.id_reserva, s.id_servicio, 1, s.precio
  FROM reservas r
  JOIN servicios s ON s.nombre = 'DJ privado'
 WHERE r.estado = 'confirmada';

INSERT INTO detalle_reserva (id_reserva, id_servicio, cantidad, precio_unitario)
SELECT r.id_reserva, s.id_servicio, 1, s.precio
  FROM reservas r
  JOIN servicios s ON s.nombre = 'Barra libre 2h'
 WHERE r.estado = 'confirmada';

-- Detalle de la reserva pendiente.
INSERT INTO detalle_reserva (id_reserva, id_servicio, cantidad, precio_unitario)
SELECT r.id_reserva, s.id_servicio, 1, s.precio
  FROM reservas r
  JOIN servicios s ON s.nombre = 'Barra libre 2h'
 WHERE r.estado = 'pendiente';

-- Detalle de la reserva cancelada.
INSERT INTO detalle_reserva (id_reserva, id_servicio, cantidad, precio_unitario)
SELECT r.id_reserva, s.id_servicio, 1, s.precio
  FROM reservas r
  JOIN servicios s ON s.nombre = 'Mesa VIP'
 WHERE r.estado = 'cancelada';

-- ---------------------------------------------------------------------
-- 9. INGRESOS (RN-05 / RN-06 / comparativo RF-DES-10)
--    Los de las fechas de los eventos FINALIZADOS alimentan la
--    asistencia del comparativo; el de hoy alimenta el aforo.
-- ---------------------------------------------------------------------
INSERT INTO ingresos (id_cliente, id_reserva, codigo_qr, fecha, hora, puerta_acceso, tipo_dispositivo, validado_por, estado)
SELECT cl.id_cliente, NULL, 'QR-SEED-ING01', e.fecha, '21:30', 'Puerta principal', 'movil',
       (SELECT u.id_usuario FROM usuarios u WHERE u.email = 'admin@correo.mx'), 'valido'
  FROM clientes cl
  JOIN evento e ON e.nombre = 'Noche Neon'
 WHERE cl.documento = 'CC-100100';

INSERT INTO ingresos (id_cliente, id_reserva, codigo_qr, fecha, hora, puerta_acceso, tipo_dispositivo, validado_por, estado)
SELECT cl.id_cliente, NULL, 'QR-SEED-ING02', e.fecha, '22:00', 'Puerta principal', 'fijo',
       (SELECT u.id_usuario FROM usuarios u WHERE u.email = 'admin@correo.mx'), 'valido'
  FROM clientes cl
  JOIN evento e ON e.nombre = 'Noche Neon'
 WHERE cl.documento = 'CC-100300';

INSERT INTO ingresos (id_cliente, id_reserva, codigo_qr, fecha, hora, puerta_acceso, tipo_dispositivo, validado_por, estado)
SELECT cl.id_cliente, NULL, 'QR-SEED-ING03', e.fecha, '19:10', 'Puerta lateral', 'movil',
       (SELECT u.id_usuario FROM usuarios u WHERE u.email = 'admin@correo.mx'), 'valido'
  FROM clientes cl
  JOIN evento e ON e.nombre = 'Boda Gomez'
 WHERE cl.documento = 'CC-100200';

-- Entrada de HOY (alimenta GET /api/ingresos/aforo).
INSERT INTO ingresos (id_cliente, id_reserva, codigo_qr, fecha, hora, puerta_acceso, tipo_dispositivo, validado_por, estado)
SELECT cl.id_cliente, NULL, 'QR-SEED-ING04', CURDATE(), '21:05', 'Puerta principal', 'movil',
       (SELECT u.id_usuario FROM usuarios u WHERE u.email = 'admin@correo.mx'), 'valido'
  FROM clientes cl WHERE cl.documento = 'CC-100100';

-- Entrada rechazada (para filtros por estado).
INSERT INTO ingresos (id_cliente, id_reserva, codigo_qr, fecha, hora, puerta_acceso, tipo_dispositivo, validado_por, estado)
SELECT cl.id_cliente, NULL, 'QR-SEED-ING05', CURDATE(), '21:40', 'Puerta principal', 'movil',
       (SELECT u.id_usuario FROM usuarios u WHERE u.email = 'empleado@correo.mx'), 'rechazado'
  FROM clientes cl WHERE cl.documento = 'CC-100500';

-- ---------------------------------------------------------------------
-- 10. VENTAS (RN-09 / RN-10) CON DETALLE E IVA
--     Las PAGADAS llevan total = base * 1.16 y comprobante unico.
--     Fechas repartidas en 3 meses para el reporte mes a mes.
--     subtotal de detalle_ventas es GENERADO: NUNCA se inserta.
-- ---------------------------------------------------------------------
INSERT INTO ventas (id_cliente, fecha_venta, total, metodo_pago, comprobante_no, estado)
SELECT cl.id_cliente, DATE_SUB(NOW(), INTERVAL 75 DAY), 46400.00, 'efectivo', 'COM-SEED00000004', 'pagada'
  FROM clientes cl WHERE cl.documento = 'CC-100100';

INSERT INTO ventas (id_cliente, fecha_venta, total, metodo_pago, comprobante_no, estado)
SELECT cl.id_cliente, DATE_SUB(NOW(), INTERVAL 45 DAY), 32480.00, 'efectivo', 'COM-SEED00000001', 'pagada'
  FROM clientes cl WHERE cl.documento = 'CC-100100';

INSERT INTO ventas (id_cliente, fecha_venta, total, metodo_pago, comprobante_no, estado)
SELECT cl.id_cliente, DATE_SUB(NOW(), INTERVAL 20 DAY), 147320.00, 'tarjeta', 'COM-SEED00000002', 'pagada'
  FROM clientes cl WHERE cl.documento = 'CC-100300';

INSERT INTO ventas (id_cliente, fecha_venta, total, metodo_pago, comprobante_no, estado)
SELECT cl.id_cliente, DATE_SUB(NOW(), INTERVAL 2 DAY), 37120.00, 'transferencia', 'COM-SEED00000003', 'pagada'
  FROM clientes cl WHERE cl.documento = 'CC-100200';

-- Pendiente: total SIN IVA (el IVA y el comprobante los pone /pagar).
INSERT INTO ventas (id_cliente, fecha_venta, total, metodo_pago, comprobante_no, estado)
SELECT cl.id_cliente, NOW(), 16000.00, 'efectivo', NULL, 'pendiente'
  FROM clientes cl WHERE cl.documento = 'CC-100400';

-- Anulada: conserva su comprobante por auditoria.
INSERT INTO ventas (id_cliente, fecha_venta, total, metodo_pago, comprobante_no, estado)
SELECT cl.id_cliente, DATE_SUB(NOW(), INTERVAL 15 DAY), 9280.00, 'efectivo', 'COM-SEED00000006', 'anulada'
  FROM clientes cl WHERE cl.documento = 'CC-100300';

-- Lineas de cada venta (precio = catalogo, igual que la API).
-- Venta hace 75 dias: gaseosa x10 (base 40000 -> 46400 con IVA).
INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
SELECT v.id_venta, p.id_producto, 10, p.precio_venta
  FROM ventas v
  JOIN productos p ON p.nombre = 'Gaseosa 355ml'
 WHERE v.comprobante_no = 'COM-SEED00000004';

-- Venta hace 45 dias: cerveza x2 + gaseosa x3 (base 28000 -> 32480).
INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
SELECT v.id_venta, p.id_producto, 2, p.precio_venta
  FROM ventas v
  JOIN productos p ON p.nombre = 'Cerveza artesanal 330ml'
 WHERE v.comprobante_no = 'COM-SEED00000001';

INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
SELECT v.id_venta, p.id_producto, 3, p.precio_venta
  FROM ventas v
  JOIN productos p ON p.nombre = 'Gaseosa 355ml'
 WHERE v.comprobante_no = 'COM-SEED00000001';

-- Venta hace 20 dias: vodka x1 + agua x2 (base 127000 -> 147320).
INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
SELECT v.id_venta, p.id_producto, 1, p.precio_venta
  FROM ventas v
  JOIN productos p ON p.nombre = 'Vodka premium 700ml'
 WHERE v.comprobante_no = 'COM-SEED00000002';

INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
SELECT v.id_venta, p.id_producto, 2, p.precio_venta
  FROM ventas v
  JOIN productos p ON p.nombre = 'Agua mineral 600ml'
 WHERE v.comprobante_no = 'COM-SEED00000002';

-- Venta hace 2 dias: cerveza x4 (base 32000 -> 37120).
INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
SELECT v.id_venta, p.id_producto, 4, p.precio_venta
  FROM ventas v
  JOIN productos p ON p.nombre = 'Cerveza artesanal 330ml'
 WHERE v.comprobante_no = 'COM-SEED00000003';

-- Venta pendiente: cerveza x2 (base 16000, todavia sin IVA).
INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
SELECT v.id_venta, p.id_producto, 2, p.precio_venta
  FROM ventas v
  JOIN productos p ON p.nombre = 'Cerveza artesanal 330ml'
 WHERE v.estado = 'pendiente';

-- Venta anulada: cerveza x1 (base 8000 -> 9280 con IVA).
INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario)
SELECT v.id_venta, p.id_producto, 1, p.precio_venta
  FROM ventas v
  JOIN productos p ON p.nombre = 'Cerveza artesanal 330ml'
 WHERE v.estado = 'anulada';

-- ---------------------------------------------------------------------
-- 11. PROGRAMA DE PUNTOS (RN-11)
--     1 punto por cada $10 de ventas PAGADAS (floor(total / 10)):
--       Carlos:  (46400 + 32480) / 10 = 7888 acumulados, 500 canjeados
--       Jorge:   147320 / 10          = 14732, canjeados 0
--       Maria:   37120 / 10           = 3712,  canjeados 0
-- ---------------------------------------------------------------------
INSERT INTO programa_puntos (id_cliente, puntos_acumulados, puntos_canjeados)
SELECT cl.id_cliente, 7888, 500 FROM clientes cl WHERE cl.documento = 'CC-100100';

INSERT INTO programa_puntos (id_cliente, puntos_acumulados, puntos_canjeados)
SELECT cl.id_cliente, 14732, 0 FROM clientes cl WHERE cl.documento = 'CC-100300';

INSERT INTO programa_puntos (id_cliente, puntos_acumulados, puntos_canjeados)
SELECT cl.id_cliente, 3712, 0 FROM clientes cl WHERE cl.documento = 'CC-100200';

-- ---------------------------------------------------------------------
-- 12. NOTIFICACIONES SIMULADAS (RN-12)
-- ---------------------------------------------------------------------
INSERT INTO notificaciones (id_cliente, tipo, canal, mensaje, fecha_envio, estado)
SELECT cl.id_cliente, 'promocion', 'email',
       'Este finde todas las cervezas al 20% de descuento. No faltes.',
       DATE_SUB(NOW(), INTERVAL 2 DAY), 'enviada'
  FROM clientes cl WHERE cl.documento = 'CC-100100';

INSERT INTO notificaciones (id_cliente, tipo, canal, mensaje, fecha_envio, estado)
SELECT cl.id_cliente, 'evento', 'email',
       'Nuevo evento: "Fiesta 80s" programado. No te lo pierdas.',
       DATE_SUB(NOW(), INTERVAL 1 DAY), 'enviada'
  FROM clientes cl WHERE cl.documento = 'CC-100300';

INSERT INTO notificaciones (id_cliente, tipo, canal, mensaje, fecha_envio, estado)
SELECT cl.id_cliente, 'cumpleanos', 'sms',
       'Feliz cumpleanos! Te esperamos en Discoteca.',
       NULL, 'fallida'
  FROM clientes cl WHERE cl.documento = 'CC-100400';

-- =====================================================================
-- FIN DEL SEED
-- Filas esperadas (aprox.): 3 roles, 19 permisos, 12 asignaciones,
-- 3 usuarios, 2 categorias de cliente, 4 de empleado, 4 empleados,
-- 3 proveedores, 6 productos, 6 servicios, 6 clientes, 2 compras con
-- 3 lineas, 4 eventos, 2 fichas con 4 servicios, 2 agendas de evento,
-- 2 turnos validos, 3 reservas con 5 lineas, 5 ingresos, 6 ventas con
-- 8 lineas, 3 programas de puntos y 3 notificaciones.
-- =====================================================================
