/**
 * tests/modelos.test.js
 * ---------------------------------------------------------------------
 * Pruebas de los modelos (P6): fabricas desdeFila/desdeJSON,
 * serializacion toJSON y el campo derivado `pendiente` que usan los
 * guards de compra/reserva/venta (regresion del bug de la prueba
 * global: toJSON omitia `pendiente` y PUT/DELETE respondian 409).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const Compra = require('../src/models/Compra.js');
const Venta = require('../src/models/Venta.js');
const Reserva = require('../src/models/Reserva.js');

test('Compra.desdeFila arma el objeto y toJSON expone pendiente', () => {
  const compra = Compra.desdeFila({
    id_compra: 7,
    id_proveedor: 2,
    fecha_compra: '2026-01-05',
    total: '1500.00',
    estado: 'pendiente',
    nombreProveedor: 'Bebidas SA'
  });
  const json = compra.toJSON();
  assert.equal(json.id, 7);
  assert.equal(json.total, 1500);
  assert.equal(json.estado, 'pendiente');
  assert.equal(json.pendiente, true);
  assert.equal(compra.estaPendiente(), true);
});

test('Compra confirmada ya no esta pendiente', () => {
  const compra = Compra.desdeJSON({ idProveedor: 1, total: 900, estado: 'confirmada' });
  assert.equal(compra.toJSON().pendiente, false);
});

test('Venta.desdeFila y toJSON incluyen pendiente (regresion 409)', () => {
  const venta = Venta.desdeFila({
    id_venta: 3,
    id_cliente: 1,
    fecha_venta: '2026-10-10 22:00:00',
    total: '8500.00',
    metodo_pago: 'tarjeta',
    comprobante_no: 'COM-0001',
    estado: 'pagada'
  });
  const json = venta.toJSON();
  assert.equal(json.id, 3);
  assert.equal(json.metodoPago, 'tarjeta');
  assert.equal(json.comprobanteNo, 'COM-0001');
  // Pagada NO es pendiente: los guards de edicion deben dejar pasar
  // la comprobacion de estado (antes fallaba siempre por undefined).
  assert.equal(json.pendiente, false);
});

test('Venta pendiente si expone pendiente=true', () => {
  const venta = Venta.desdeFila({
    id_venta: 12,
    id_cliente: 2,
    fecha_venta: '2026-10-18 23:00:00',
    total: '4300.00',
    metodo_pago: 'efectivo',
    comprobante_no: null,
    estado: 'pendiente'
  });
  assert.equal(venta.toJSON().pendiente, true);
});

test('Reserva.desdeFila y toJSON incluyen pendiente (regresion 409)', () => {
  const reserva = Reserva.desdeFila({
    id_reserva: 4,
    id_cliente: 1,
    tipo_espacio: 'mesa',
    identificador_espacio: 'MESA-01',
    fecha: '2026-12-24',
    hora: '22:00:00',
    descuento: 0,
    subtotal: 1200,
    estado: 'pendiente',
    codigo_qr: null
  });
  const json = reserva.toJSON();
  assert.equal(json.identificadorEspacio, 'MESA-01');
  assert.equal(json.estado, 'pendiente');
  assert.equal(json.pendiente, true);
});

test('Reserva confirmada expone pendiente=false y conserva el QR', () => {
  const reserva = Reserva.desdeFila({
    id_reserva: 9,
    id_cliente: 1,
    tipo_espacio: 'vip',
    identificador_espacio: 'VIP-1',
    fecha: '2026-12-31',
    hora: '21:00:00',
    descuento: 100,
    subtotal: 2000,
    estado: 'confirmada',
    codigo_qr: 'R-ABC123'
  });
  const json = reserva.toJSON();
  assert.equal(json.pendiente, false);
  assert.equal(json.codigoQr, 'R-ABC123');
});

test('los modelos rechazan filas nulas con desdeFila(null) === null', () => {
  assert.equal(Compra.desdeFila(null), null);
  assert.equal(Venta.desdeFila(null), null);
  assert.equal(Reserva.desdeFila(null), null);
});
