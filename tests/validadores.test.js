/**
 * tests/validadores.test.js
 * ---------------------------------------------------------------------
 * Pruebas de src/utils/validadores.js, en especial el ColectorErrores
 * que sostiene el contrato 400 con detalles[] por campo (RNF-USA-01).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  esCorreoValido,
  esContrasenaFuerte,
  esEnteroPositivo,
  estaEnLista,
  ColectorErrores
} = require('../src/utils/validadores.js');
const AppError = require('../src/utils/AppError.js');

test('esCorreoValido acepta solo correos bien formados', () => {
  assert.equal(esCorreoValido('ana@correo.com'), true);
  assert.equal(esCorreoValido('ANA@CORREO.MX'), true);
  assert.equal(esCorreoValido('sin-arroba.com'), false);
  assert.equal(esCorreoValido(''), false);
  assert.equal(esCorreoValido(null), false);
});

test('esContrasenaFuerte exige longitud y tipos mezclados', () => {
  assert.equal(esContrasenaFuerte('Admin1234'), true);
  assert.equal(esContrasenaFuerte('corta1A'), false);
  assert.equal(esContrasenaFuerte('sinsinumeros'), false);
  assert.equal(esContrasenaFuerte('12345678'), false);
});

test('esEnteroPositivo y estaEnLista validan valores de catalogo', () => {
  assert.equal(esEnteroPositivo(3), true);
  assert.equal(esEnteroPositivo(0), false);
  assert.equal(esEnteroPositivo('dos'), false);
  assert.equal(estaEnLista('confirmada', ['pendiente', 'confirmada']), true);
  assert.equal(estaEnLista('vencida', ['pendiente', 'confirmada']), false);
});

test('ColectorErrores acumula errores y lanza AppError 400', () => {
  const colector = new ColectorErrores();
  colector.agregar('nombre', 'El nombre es obligatorio');
  colector.agregarSi(true, 'email', 'El email no es valido');
  colector.agregarSi(false, 'telefono', 'no debe aparecer');

  assert.equal(colector.cantidad, 2);
  assert.equal(colector.esValido, false);
  assert.deepEqual(colector.errores[0], { campo: 'nombre', mensaje: 'El nombre es obligatorio' });

  // errores() entrega una copia: no se puede tocar la lista interna.
  colector.errores.pop();
  assert.equal(colector.cantidad, 2);

  assert.throws(
    () => colector.lanzarSiHay('Datos invalidos'),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.estado, 400);
      assert.equal(error.codigo, 'E-400');
      assert.equal(error.detalles.length, 2);
      return true;
    }
  );
});

test('ColectorErrores.lanzarSiHay no lanza cuando no hay errores', () => {
  const colector = new ColectorErrores();
  assert.equal(colector.esValido, true);
  assert.doesNotThrow(() => colector.lanzarSiHay('ok'));
});
