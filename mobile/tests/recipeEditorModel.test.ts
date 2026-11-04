import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraft, RecipeValidationError } from '../src/domain/recipe.ts';
import { buildRecipeForSave, editorExitAction, recipeDraftFromSaved } from '../src/ui/recipeEditorModel.ts';
import type { SavedRecipe } from '../src/storage/recipeRepository.ts';

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
