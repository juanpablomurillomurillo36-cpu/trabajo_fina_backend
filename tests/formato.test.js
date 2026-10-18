/**
 * tests/formato.test.js
 * ---------------------------------------------------------------------
 * Pruebas de las normalizaciones de src/utils/formato.js (R-DRY).
 * Son puras (sin base de datos ni red), asi corren con `npm test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const formato = require('../src/utils/formato.js');

test('limpiarTexto colapsa espacios y devuelve null con vacios', () => {
  assert.equal(formato.limpiarTexto('  Ana   Maria  '), 'Ana Maria');
  assert.equal(formato.limpiarTexto('   '), null);
  assert.equal(formato.limpiarTexto(null), null);
  assert.equal(formato.limpiarTexto(123), null);
});

test('aTituloPropio normaliza nombres propios', () => {
  assert.equal(formato.aTituloPropio('ANA maria'), 'Ana Maria');
  assert.equal(formato.aTituloPropio('jUAN pABLO gOMEZ'), 'Juan Pablo Gomez');
  assert.equal(formato.aTituloPropio(''), null);
});

test('aMinusculas deja todo en minusculas (correos)', () => {
  assert.equal(formato.aMinusculas('  Ana@Correo.COM '), 'ana@correo.com');
  assert.equal(formato.aMinusculas(null), null);
});

test('aEnteroONulo convierte y trunca; null si no es util', () => {
  assert.equal(formato.aEnteroONulo('15'), 15);
  assert.equal(formato.aEnteroONulo('15.7'), 15);
  assert.equal(formato.aEnteroONulo(-4.2), -4);
  assert.equal(formato.aEnteroONulo('abc'), null);
  assert.equal(formato.aEnteroONulo(''), null);
  assert.equal(formato.aEnteroONulo(undefined), null);
});

test('aDecimalONulo acepta numeros y texto con signo de moneda', () => {
  assert.equal(formato.aDecimalONulo(1500.5), 1500.5);
  assert.equal(formato.aDecimalONulo('1500.00'), 1500);
  assert.equal(formato.aDecimalONulo('$1,250.75'), 1250.75);
  // 'gratis' no contiene cifras: la limpieza deja la cadena vacia y
  // el resultado debe ser null (no 0, que se confundiria con un precio).
  assert.equal(formato.aDecimalONulo('gratis'), null);
  assert.equal(formato.aDecimalONulo(''), null);
});

test('aHoraONulo normaliza a HH:MM:SS y rechaza horas invalidas', () => {
  assert.equal(formato.aHoraONulo('18:30'), '18:30:00');
  assert.equal(formato.aHoraONulo('18:30:15'), '18:30:15');
  assert.equal(formato.aHoraONulo('25:00'), null);
  assert.equal(formato.aHoraONulo('mañana'), null);
  assert.equal(formato.aHoraONulo(null), null);
});

test('redondearDosDecimales evita el error de punto flotante', () => {
  assert.equal(formato.redondearDosDecimales(2.005), 2.01);
  assert.equal(formato.redondearDosDecimales(1500.456), 1500.46);
  assert.equal(formato.redondearDosDecimales(10), 10);
});

test('aTextoMoneda formatea MXN o avisa cuando no hay numero', () => {
  assert.match(formato.aTextoMoneda(1500), /1,500\.00/);
  assert.equal(formato.aTextoMoneda('no-numero'), 'No disponible');
});

test('estaVacio considera vacios solo los objetos sin propiedades', () => {
  assert.equal(formato.estaVacio({}), true);
  assert.equal(formato.estaVacio(null), true);
  assert.equal(formato.estaVacio(undefined), true);
  assert.equal(formato.estaVacio({ nombre: 'Ana' }), false);
  // Un objeto con una clave presente NO esta vacio aunque su valor
  // sea texto vacio: quien decide si falta el campo es el validador.
  assert.equal(formato.estaVacio({ nombre: '' }), false);
  assert.equal(formato.estaVacio('texto'), false);
});

test('soloCamposPermitidos deja pasar unicamente los campos autorizados', () => {
  const limpio = formato.soloCamposPermitidos(
    { nombre: 'Ana', secreto: 'x', telefono: '300' },
    ['nombre', 'telefono']
  );
  assert.deepEqual(limpio, { nombre: 'Ana', telefono: '300' });
  assert.deepEqual(formato.soloCamposPermitidos({ a: 1 }, []), {});
});
