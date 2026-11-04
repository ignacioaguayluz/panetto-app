import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraft, editIngredient } from '../src/domain/recipe.ts';
import {
  calculateEditorProduction,
  productionSourceKey,
  updateProductionInput,
} from '../src/ui/recipeEditorModel.ts';

const draft = createDraft('Pan', 'percent', [
  { id: 'f', name: 'Harina', isFlour: true, value: 100 },
  { id: 'w', name: 'Agua', isFlour: false, value: 70 },
  { id: 's', name: 'Sal', isFlour: false, value: 2 },
]);

test('S4: explicit calculation presents every ingredient and total without rounding intermediate values', () => {
  const one = calculateEditorProduction(draft, {}, {}, '1', '400');
  assert.deepEqual(one.rows.map(row => [row.name, row.text]), [
    ['Harina', '232,56 g'], ['Agua', '162,79 g'], ['Sal', '4,65 g'],
  ]);
  assert.equal(one.totalText, '400 g');
  const two = calculateEditorProduction(draft, {}, {}, '2', '400');
  assert.equal(two.production.totalGrams, 800);
  one.production.ingredients.forEach((item, index) => {
    assert.equal(two.production.ingredients[index].grams, item.grams * 2);
  });
  assert.equal(calculateEditorProduction(draft, {}, {}, '1', '0,25').totalText, '0,25 g');
  assert.equal(calculateEditorProduction(draft, {}, {}, '1', '.25').production.totalGrams, 0.25);
});

test('S4: invalid, unfinished, nonfinite, nonpositive and fractional piece input gives field-specific errors', () => {
  const before = JSON.stringify(draft);
  for (const pieces of ['', '1,', '1.5', '0', '-1', 'Infinity', 'NaN', '1e3', '9'.repeat(400)]) {
    assert.throws(() => calculateEditorProduction(draft, {}, {}, pieces, '400'),
      { message: 'La cantidad de piezas debe ser un entero mayor que cero.' });
  }
  for (const grams of ['', '1,', '0', '-1', 'Infinity', 'NaN', '1.000,5', '9'.repeat(400)]) {
    assert.throws(() => calculateEditorProduction(draft, {}, {}, '1', grams),
      { message: 'Los gramos por pieza deben ser un número finito mayor que cero, con coma o punto decimal.' });
  }
  assert.throws(() => calculateEditorProduction(draft, {}, {}, '9'.repeat(300), '9'.repeat(300)),
    { message: 'Ingresa un valor finito mayor que cero.' });
  assert.equal(JSON.stringify(draft), before);
});

test('S4/S7: calculate uses current valid draft without saving or changing formula/exit state', () => {
  const saved = { id: 'bread', ...draft };
  const before = JSON.stringify(saved);
  const edited = editIngredient(draft, 'w', { value: 80 });
  const editedBefore = JSON.stringify(edited);
  const result = calculateEditorProduction(edited, { w: '80' }, {}, '1', '400');
  assert.equal(result.production.ingredients[1].grams, 400 * (80 / 182));
  assert.equal(JSON.stringify(edited), editedBefore);
  assert.equal(JSON.stringify(saved), before);
  assert.throws(() => calculateEditorProduction(edited, { w: '1,' }, {}, '1', '400'));
  assert.throws(() => calculateEditorProduction(edited, {}, { w: 'Corregí el ingrediente.' }, '1', '400'),
    { message: 'Corregí el ingrediente.' });
  assert.throws(() => calculateEditorProduction(createDraft('Pan', 'grams'), {}, {}, '1', '400'),
    { message: 'Agrega al menos una harina con cantidad positiva.' });
});

test('S4: editing either input clears results; every editor source change gets a new calculator session key', () => {
  const result = calculateEditorProduction(draft, {}, {}, '1', '400');
  const state = { pieceCount: '1', gramsPerPiece: '400', result, error: 'old error' };
  assert.deepEqual(updateProductionInput(state, 'pieceCount', '2'),
    { pieceCount: '2', gramsPerPiece: '400', result: null, error: '' });
  assert.deepEqual(updateProductionInput(state, 'gramsPerPiece', '1,'),
    { pieceCount: '1', gramsPerPiece: '1,', result: null, error: '' });
  const key = productionSourceKey(draft, {}, {});
  for (const changed of [
    editIngredient(draft, 'w', { value: 80 }),
    editIngredient(draft, 'w', { name: 'Agua fría' }),
    editIngredient(draft, 'w', { isFlour: true }),
    { ...draft, ingredients: draft.ingredients.slice(0, 1) },
  ]) assert.notEqual(productionSourceKey(changed, {}, {}), key);
  assert.notEqual(productionSourceKey(draft, { w: '1,' }, {}), key);
  assert.notEqual(productionSourceKey(draft, {}, { f: 'Error' }), key);
});

test('S5: sourdough and preferment remain direct ingredients, without inferred flour or hydration output', () => {
  const direct = createDraft('Pan', 'percent', [
    ...draft.ingredients,
    { id: 'm', name: 'Masa madre', isFlour: false, value: 20 },
    { id: 'p', name: 'Prefermento', isFlour: false, value: 10 },
  ]);
  const before = JSON.stringify(direct);
  const result = calculateEditorProduction(direct, {}, {}, '1', '202');
  assert.deepEqual(result.rows.map(row => [row.name, row.text]), [
    ['Harina', '100 g'], ['Agua', '70 g'], ['Sal', '2 g'], ['Masa madre', '20 g'], ['Prefermento', '10 g'],
  ]);
  assert.equal(result.totalText, '202 g');
  assert.deepEqual(Object.keys(result).sort(), ['production', 'rows', 'totalText']);
  assert.equal(JSON.stringify(direct), before);
});
