import assert from 'node:assert/strict';
import test from 'node:test';
import { addIngredient, calculateProduction, createDraft, editIngredient, formatGrams, parseDecimal, removeIngredient, saveRecipe, switchMode } from '../src/domain/recipe.ts';

const ingredient = (id: string, value: number, isFlour = false) => ({ id, name: id, value, isFlour });
const standard = () => createDraft('Pan', 'percent', [ingredient('harina', 100, true), ingredient('agua', 70), ingredient('sal', 2)]);
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const unchanged = (value: unknown, action: () => unknown) => {
  const before = structuredClone(value);
  assert.throws(action);
  assert.deepEqual(value, before);
};

test('S2: grams preserve other weights, derive canonical percentages and retain editing context', () => {
  const original = createDraft('Pan', 'grams', [ingredient('a', 300, true), ingredient('b', 200, true), ingredient('agua', 350)]);
  const edited = editIngredient(original, 'a', { value: 400 });
  assert.deepEqual(original.ingredients.map(i => i.value), [300, 200, 350]);
  assert.deepEqual(edited.ingredients.map(i => i.value), [400, 200, 350]);
  const saved = saveRecipe(edited);
  close(saved.ingredients[0].percentage, 400 / 600 * 100);
  close(saved.ingredients[2].percentage, 350 / 600 * 100);
  assert.deepEqual(saved.baseGrams, { a: 400, b: 200, agua: 350 });
  assert.deepEqual(switchMode(switchMode(edited, 'percent'), 'grams').ingredients, edited.ingredients);
});

test('S2: percent-only formula needs no invented grams; explicit flour base enables conversion', () => {
  const draft = standard();
  assert.equal(saveRecipe(draft).baseGrams, undefined);
  unchanged(draft, () => switchMode(draft, 'grams'));
  const grams = switchMode(draft, 'grams', 500);
  assert.deepEqual(grams.ingredients.map(i => i.value), [500, 350, 10]);
  assert.deepEqual(saveRecipe(switchMode(grams, 'percent')).baseGrams, { harina: 500, agua: 350, sal: 10 });
  for (const base of [0, -1, NaN, Infinity]) unchanged(draft, () => switchMode(draft, 'grams', base));
});

test('S3: flour edits redistribute proportionally without touching non-flours', () => {
  const draft = createDraft('Pan', 'percent', [ingredient('a', 50, true), ingredient('b', 30, true), ingredient('c', 20, true), ingredient('agua', 140)]);
  const edited = editIngredient(draft, 'a', { value: 20 });
  assert.deepEqual(edited.ingredients.map(i => i.value), [20, 48, 32, 140]);
  assert.equal(draft.ingredients[0].value, 50);
  const zeroOthers = createDraft('Pan', 'percent', [ingredient('a', 100, true), ingredient('b', 0, true), ingredient('c', 0, true)]);
  assert.deepEqual(editIngredient(zeroOthers, 'a', { value: 40 }).ingredients.map(i => i.value), [40, 30, 30]);
  assert.equal(editIngredient(standard(), 'harina', { value: 25 }).ingredients[0].value, 100);
});

test('S2/S3: add, remove, rename and toggle flour keep draft identity and normalize by mode', () => {
  let draft = addIngredient(standard(), ingredient('integral', 25, true));
  assert.deepEqual(draft.ingredients.filter(i => i.isFlour).map(i => i.value), [80, 20]);
  draft = editIngredient(draft, 'integral', { name: 'Integral', isFlour: false });
  assert.equal(draft.ingredients[0].value, 100);
  assert.equal(draft.ingredients[3].id, 'integral');
  assert.equal(draft.ingredients[3].name, 'Integral');
  draft = editIngredient(draft, 'integral', { isFlour: true });
  close(draft.ingredients[0].value, 100 / 120 * 100);
  assert.equal(removeIngredient(draft, 'integral').ingredients[0].value, 100);
  const grams = createDraft('Pan', 'grams', [ingredient('a', 200, true), ingredient('b', 100), ingredient('agua', 210)]);
  const toggled = editIngredient(grams, 'b', { isFlour: true });
  assert.deepEqual(toggled.ingredients.map(i => i.value), [200, 100, 210]);
  assert.equal(saveRecipe(toggled).ingredients[2].percentage, 70);
  assert.equal(saveRecipe(removeIngredient(toggled, 'b')).ingredients[2 - 1].percentage, 105);
  const invalid = removeIngredient(standard(), 'harina');
  unchanged(invalid, () => saveRecipe(invalid));
  unchanged(invalid, () => calculateProduction(invalid, 1, 400));
});

test('S3: invalid entries reject atomically; zero ingredients allowed but positive flour required', () => {
  const draft = standard();
  for (const value of [-1, NaN, Infinity, -Infinity, 101]) unchanged(draft, () => editIngredient(draft, 'harina', { value }));
  for (const value of [-1, NaN, Infinity]) unchanged(draft, () => editIngredient(draft, 'agua', { value }));
  assert.equal(saveRecipe(editIngredient(draft, 'agua', { value: 150 })).ingredients[1].percentage, 150);
  assert.equal(saveRecipe(addIngredient(draft, ingredient('cero', 0))).ingredients[3].percentage, 0);
  for (const mode of ['grams', 'percent'] as const) {
    const zero = createDraft('Pan', mode, [ingredient('a', 0, true)]);
    unchanged(zero, () => saveRecipe(zero));
    unchanged(zero, () => calculateProduction(zero, 1, 1));
  }
  unchanged(draft, () => addIngredient(draft, ingredient('agua', 2)));
  unchanged(draft, () => editIngredient(draft, 'missing', { value: 1 }));
  unchanged(draft, () => removeIngredient(draft, 'missing'));
  assert.throws(() => saveRecipe(createDraft(' ', 'percent', [ingredient('a', 100, true)])));
  assert.throws(() => saveRecipe(editIngredient(draft, 'agua', { name: ' ' })));
});

test('S4: total dough scaling, acceptance example, small production and no mutation or intermediate rounding', () => {
  const recipe = saveRecipe(standard());
  const before = structuredClone(recipe);
  const one = calculateProduction(recipe, 1, 400);
  assert.equal(one.totalGrams, 400);
  assert.deepEqual(one.ingredients.map(i => formatGrams(i.grams)), ['232,56', '162,79', '4,65']);
  const two = calculateProduction(recipe, 2, 400);
  one.ingredients.forEach((i, index) => assert.equal(two.ingredients[index].grams, i.grams * 2));
  assert.equal(two.totalGrams, 800);
  const tiny = calculateProduction(recipe, 1, 0.1);
  close(tiny.ingredients.reduce((sum, i) => sum + i.grams, 0), 0.1);
  assert.deepEqual(recipe, before);
  assert.equal(formatGrams(400), '400');
  assert.equal(formatGrams(1.5), '1,5');
});

test('S4: invalid production inputs, overflow and malformed canonical formulas cannot produce results', () => {
  const recipe = saveRecipe(standard());
  for (const count of [0, -1, 1.5, NaN, Infinity]) unchanged(recipe, () => calculateProduction(recipe, count, 400));
  for (const weight of [0, -1, NaN, Infinity]) unchanged(recipe, () => calculateProduction(recipe, 1, weight));
  unchanged(recipe, () => calculateProduction(recipe, 2, Number.MAX_VALUE));
  unchanged(recipe, () => calculateProduction({ ...recipe, ingredients: recipe.ingredients.map(i => ({ ...i, percentage: NaN })) }, 1, 400));
  assert.throws(() => formatGrams(Infinity));
});

test('S2/S4: localized decimals accept comma OR point, not thousands, blank or ambiguous text', () => {
  for (const [text, expected] of [['0,5', 0.5], ['400.25', 400.25], [' 12 ', 12], ['1,234', 1.234], ['.5', 0.5], [',5', 0.5]] as const) assert.equal(parseDecimal(text), expected);
  for (const text of ['', ' ', '1,000.2', '1.000,2', '1 000', '1,2,3', 'NaN', 'Infinity', '1e3', '-1', '1abc']) assert.throws(() => parseDecimal(text));
});

test('S2/S3: percent edits update retained gram context and losing the base requires a new explicit base', () => {
  const grams = createDraft('Pan', 'grams', [ingredient('harina', 500, true), ingredient('agua', 350)]);
  const percent = switchMode(grams, 'percent');
  const edited = editIngredient(percent, 'agua', { value: 60 });
  assert.deepEqual(saveRecipe(edited).baseGrams, { harina: 500, agua: 300 });
  assert.deepEqual(switchMode(edited, 'grams').ingredients.map(i => i.value), [500, 300]);
  const noFlour = removeIngredient(percent, 'harina');
  const repaired = addIngredient(noFlour, ingredient('nueva', 100, true));
  assert.equal(saveRecipe(repaired).baseGrams, undefined);
  unchanged(repaired, () => switchMode(repaired, 'grams'));
});

test('S5: sourdough and preferments remain direct ingredients with only manual flour classification', () => {
  const draft = addIngredient(standard(), ingredient('masa madre', 20));
  const saved = saveRecipe(draft);
  assert.equal(saved.ingredients.length, 4);
  assert.equal(saved.ingredients[3].isFlour, false);
  assert.equal(saved.ingredients[1].percentage, 70);
  assert.deepEqual(calculateProduction(saved, 1, 192).ingredients.map(i => i.grams), [100, 70, 2, 20]);
});
