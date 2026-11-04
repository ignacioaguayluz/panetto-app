import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraft, RecipeValidationError } from '../src/domain/recipe.ts';
import {
  buildRecipeForSave,
  editorExitAction,
  persistEditorDraft,
  recipeDraftFromSaved,
  updateEditorIngredientValue,
} from '../src/ui/recipeEditorModel.ts';
import type { RecipeRepository, SavedRecipe } from '../src/storage/recipeRepository.ts';

const ingredients = [
  { id: 'flour', name: 'Harina', isFlour: true, percentage: 100 },
  { id: 'water', name: 'Agua', isFlour: false, percentage: 70 },
];

test('T4: reopening a gram-based recipe restores its entered weights', () => {
  const editor = recipeDraftFromSaved({
    id: 'bread', name: 'Pan', ingredients, baseGrams: { flour: 500, water: 350 },
  } satisfies SavedRecipe);

  assert.equal(editor.draft.mode, 'grams');
  assert.deepEqual(editor.draft.ingredients.map(item => item.value), [500, 350]);
  assert.deepEqual(editor.rawValues, { flour: '500', water: '350' });
});

test('T4: percentage-only recipes reopen without inventing a gram base', () => {
  const editor = recipeDraftFromSaved({ id: 'bread', name: 'Pan', ingredients } satisfies SavedRecipe);

  assert.equal(editor.draft.mode, 'percent');
  assert.deepEqual(editor.draft.ingredients.map(item => item.value), [100, 70]);
  assert.equal(editor.draft.baseGrams, undefined);
});

test('T4: saving gram entry preserves its base and persists flour-relative percentages', () => {
  const draft = createDraft('Pan', 'grams', [
    { id: 'flour', name: 'Harina', isFlour: true, value: 0 },
    { id: 'water', name: 'Agua', isFlour: false, value: 0 },
  ]);

  assert.deepEqual(buildRecipeForSave(draft, { flour: '500', water: '350' }), {
    name: 'Pan', ingredients, baseGrams: { flour: 500, water: 350 },
  });
});

test('T4: saving rejects unfinished numeric input instead of persisting a stale value', () => {
  const draft = createDraft('Pan', 'grams', [
    { id: 'flour', name: 'Harina', isFlour: true, value: 500 },
  ]);

  assert.throws(
    () => buildRecipeForSave(draft, { flour: '1,' }),
    RecipeValidationError,
  );
});

test('T4: exit decisions preserve Save, Discard and Continue editing semantics', () => {
  assert.equal(editorExitAction(false), 'leave');
  assert.equal(editorExitAction(true), 'confirm');
  assert.equal(editorExitAction(true, 'save'), 'save');
  assert.equal(editorExitAction(true, 'discard'), 'discard');
  assert.equal(editorExitAction(true, 'stay'), 'stay');
});

test('S3/S7: rejected flour range survives another valid edit', async () => {
  let saveCalls = 0;
  const stored: SavedRecipe = { id: 'bread', name: 'Pan', ingredients };
  const before = JSON.stringify(stored);
  const repository: RecipeRepository = {
    initialize: async () => {},
    list: async () => [stored],
    get: async () => stored,
    save: async () => { saveCalls += 1; },
    delete: async () => {},
  };
  const initial = recipeDraftFromSaved(stored);
  const rejected = updateEditorIngredientValue(initial.draft, 'flour', '101', initial.rawValues);
  assert.equal(rejected.error, 'El porcentaje de una harina debe estar entre 0 y 100.');
  assert.equal(rejected.rawValues.flour, '101');

  const changed = updateEditorIngredientValue(rejected.draft, 'water', '75', rejected.rawValues);
  assert.equal(changed.rawValues.flour, '101');
  await assert.rejects(
    persistEditorDraft(repository, 'bread', changed.draft, changed.rawValues),
    { message: 'El porcentaje de una harina debe estar entre 0 y 100.' },
  );
  assert.equal(saveCalls, 0);
  assert.equal(JSON.stringify(stored), before);
});

test('S3/S7: another field edit retains invalid text and prevents a stale save', async () => {
  let saveCalls = 0;
  let stored: SavedRecipe = {
    id: 'bread', name: 'Pan', ingredients, baseGrams: { flour: 500, water: 350 },
  };
  const repository: RecipeRepository = {
    initialize: async () => {},
    list: async () => [stored],
    get: async () => stored,
    save: async (id, recipe) => { saveCalls += 1; stored = { id, ...recipe }; },
    delete: async () => {},
  };
  const initial = recipeDraftFromSaved(stored);
  const invalidWater = updateEditorIngredientValue(
    initial.draft, 'water', '1,', initial.rawValues,
  );
  const changedFlour = updateEditorIngredientValue(
    invalidWater.draft, 'flour', '600', invalidWater.rawValues,
  );

  assert.equal(invalidWater.rawValues.water, '1,');
  assert.equal(changedFlour.rawValues.water, '1,');
  assert.equal(changedFlour.draft.ingredients.find(item => item.id === 'flour')?.value, 600);
  await assert.rejects(
    persistEditorDraft(repository, 'bread', changedFlour.draft, changedFlour.rawValues),
    (error: unknown) => error instanceof RecipeValidationError &&
      error.message === 'Ingresa un número válido, con coma o punto decimal y sin separadores de miles.',
  );
  assert.equal(saveCalls, 0);
  assert.deepEqual(stored, {
    id: 'bread', name: 'Pan', ingredients, baseGrams: { flour: 500, water: 350 },
  });
});
