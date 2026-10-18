/**
 * tests/fechas.test.js
 * ---------------------------------------------------------------------
 * Pruebas de src/utils/fechas.js: normalizacion de fechas y el
 * detector de solape horario que sostiene la RN-02 (reservas).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const fechas = require('../src/utils/fechas.js');

test('aFechaISO conserva el formato ISO y normaliza el resto', () => {
  assert.equal(fechas.aFechaISO('2026-12-31'), '2026-12-31');
  assert.equal(fechas.aFechaISO(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(fechas.aFechaISO('fecha imposible'), null);
  assert.equal(fechas.aFechaISO(''), null);
});

test('aFechaMySQL usa espacio en vez de T (formato DATETIME)', () => {
  const texto = fechas.aFechaMySQL(new Date(2026, 9, 18, 21, 30, 0));
  assert.equal(texto, '2026-10-18 21:30:00');
  assert.equal(fechas.aFechaMySQL('no-date'), null);
});

test('esFutura y esPasada clasifican fechas contra el reloj actual', () => {
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  assert.equal(fechas.esFutura(manana), true);
  assert.equal(fechas.esFutura(ayer), false);
  assert.equal(fechas.esPasada(ayer), true);
  assert.equal(fechas.esPasada(manana), false);
  assert.equal(fechas.esFutura('no-date'), false);
});

test('ahoraEnMySQL devuelve la fecha actual en formato MySQL', () => {
  assert.match(fechas.ahoraEnMySQL(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('haySolapeHorario detecta traslape real (RN-02)', () => {
  // Se traslapan: 21-23 contra 22-00
  assert.equal(
    fechas.haySolapeHorario('2026-11-01T21:00', '2026-11-01T23:00', '2026-11-01T22:00', '2026-11-02T00:00'),
    true
  );
  // Se tocan en 23:00 pero no se traslapan
  assert.equal(
    fechas.haySolapeHorario('2026-11-01T21:00', '2026-11-01T23:00', '2026-11-01T23:00', '2026-11-02T01:00'),
    false
  );
  // Intervalos separados
  assert.equal(
    fechas.haySolapeHorario('2026-11-01T20:00', '2026-11-01T21:00', '2026-11-01T22:00', '2026-11-01T23:00'),
    false
  );
  // Cualquier fecha ilegible -> no arriesga un conflicto falso
  assert.equal(fechas.haySolapeHorario('x', 'y', 'z', 'w'), false);
});
