/**
 * tests/app-error.test.js
 * ---------------------------------------------------------------------
 * Pruebas del contrato de error unico (C4): cada tipo de AppError
 * lleva el codigo E-xxx y el estado HTTP que espera el frontend.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const AppError = require('../src/utils/AppError.js');

test('validacion responde 400 con detalles por campo', () => {
  const error = AppError.validacion('Datos invalidos', [{ campo: 'nombre', mensaje: 'obligatorio' }]);
  assert.equal(error.estado, 400);
  assert.equal(error.codigo, 'E-400');
  assert.equal(error.detalles.length, 1);
});

test('noAutenticado responde 401 y sinPermiso responde 403', () => {
  assert.equal(AppError.noAutenticado('Token faltante').estado, 401);
  assert.equal(AppError.noAutenticado('Token faltante').codigo, 'E-401');
  assert.equal(AppError.sinPermiso('Sin permiso').estado, 403);
  assert.equal(AppError.sinPermiso('Sin permiso').codigo, 'E-403');
});

test('noEncontrado responde 404 y conflicto responde 409', () => {
  assert.equal(AppError.noEncontrado('No existe').estado, 404);
  assert.equal(AppError.noEncontrado('No existe').codigo, 'E-404');
  assert.equal(AppError.conflicto('Ya existe').estado, 409);
  assert.equal(AppError.conflicto('Ya existe').codigo, 'E-409');
});

test('interno responde 500 y conserva el mensaje', () => {
  const error = AppError.interno('Fallo de base de datos');
  assert.equal(error.estado, 500);
  assert.equal(error.codigo, 'E-500');
  assert.equal(error.message, 'Fallo de base de datos');
});

test('aRespuestaError respeta el contrato {codigo,mensaje,detalles}', () => {
  const error = AppError.conflicto('Nombre duplicado');
  assert.deepEqual(error.aRespuestaError(), {
    codigo: 'E-409',
    mensaje: 'Nombre duplicado',
    detalles: []
  });
});

test('aRespuestaError oculta el mensaje interno en el 500', () => {
  const error = AppError.interno('Detalle tecnico que no debe filtrarse');
  const respuesta = error.aRespuestaError();
  assert.equal(respuesta.mensaje, 'Ocurrio un error inesperado en el servidor.');
});
