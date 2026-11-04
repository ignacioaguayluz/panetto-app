import {
  calculateProduction,
  createDraft,
  formatGrams,
  editIngredient,
  parseDecimal,
  RecipeValidationError,
  saveRecipe,
  type Production,
  type Recipe,
  type RecipeDraft,
} from '../domain/recipe.ts';
import type { RecipeRepository, SavedRecipe } from '../storage/recipeRepository.ts';

export interface EditorProductionResult {
  readonly production: Production;
  readonly rows: readonly { readonly id: string; readonly name: string; readonly text: string }[];
  readonly totalText: string;
}

export interface ProductionCalculatorState {
  readonly pieceCount: string;
  readonly gramsPerPiece: string;
  readonly result: EditorProductionResult | null;
  readonly error: string;
}

/** A changed editor source remounts the calculator, dropping even results from rejected raw edits. */
export function productionSourceKey(
  draft: RecipeDraft,
  rawValues: Readonly<Record<string, string>>,
  invalidInputs: Readonly<Record<string, string>>,
): string {
  return JSON.stringify([draft, rawValues, invalidInputs]);
}

export function updateProductionInput(
  state: ProductionCalculatorState,
  field: 'pieceCount' | 'gramsPerPiece',
  text: string,
): ProductionCalculatorState {
  return { ...state, [field]: text, result: null, error: '' };
}

/** A read-only calculation boundary: validation builds a formula but never writes to the repository. */
export function calculateEditorProduction(
  draft: RecipeDraft,
  rawValues: Readonly<Record<string, string>>,
  invalidInputs: Readonly<Record<string, string>>,
  pieceCountText: string,
  gramsPerPieceText: string,
): EditorProductionResult {
  let pieceCount: number;
  try {
    pieceCount = parseDecimal(pieceCountText);
    if (!Number.isInteger(pieceCount) || pieceCount <= 0) throw new Error();
  } catch {
    throw new RecipeValidationError('La cantidad de piezas debe ser un entero mayor que cero.');
  }
  let gramsPerPiece: number;
  try {
    gramsPerPiece = parseDecimal(gramsPerPieceText);
    if (gramsPerPiece <= 0) throw new Error();
  } catch {
    throw new RecipeValidationError('Los gramos por pieza deben ser un número finito mayor que cero, con coma o punto decimal.');
  }
  const recipe = buildRecipeForSave(draft, rawValues, invalidInputs);
  const production = calculateProduction(recipe, pieceCount, gramsPerPiece);
  return {
    production,
    rows: production.ingredients.map(item => ({ id: item.id, name: item.name, text: `${formatGrams(item.grams)} g` })),
    totalText: `${formatGrams(production.totalGrams)} g`,
  };
}

export interface RecipeEditorModel {
  readonly draft: RecipeDraft;
  readonly rawValues: Readonly<Record<string, string>>;
}

export type EditorExitChoice = 'save' | 'discard' | 'stay';
export type EditorExitAction = 'leave' | 'confirm' | EditorExitChoice;

export function editorExitAction(hasUnsavedChanges: boolean, choice?: EditorExitChoice): EditorExitAction {
  if (!hasUnsavedChanges) return 'leave';
  return choice ?? 'confirm';
}

export interface IngredientEditResult {
  readonly draft: RecipeDraft;
  readonly rawValues: Readonly<Record<string, string>>;
  readonly invalidInputs: Readonly<Record<string, string>>;
  readonly error?: string;
}

/** Apply one numeric input while preserving any other field that still contains invalid raw text. */
export function updateEditorIngredientValue(
  draft: RecipeDraft,
  id: string,
  text: string,
  rawValues: Readonly<Record<string, string>>,
  invalidInputs: Readonly<Record<string, string>> = {},
): IngredientEditResult {
  const pending = { ...rawValues, [id]: text };
  try {
    const updated = editIngredient(draft, id, { value: parseDecimal(text) });
    const nextInvalidInputs = { ...invalidInputs };
    delete nextInvalidInputs[id];
    return {
      draft: updated,
      rawValues: syncRawValuesWithDraft(updated, pending, nextInvalidInputs),
      invalidInputs: nextInvalidInputs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el ingrediente.';
    return { draft, rawValues: pending, invalidInputs: { ...invalidInputs, [id]: message }, error: message };
  }
}

/** Keep rejected input visible across changes to other ingredients; valid values follow normalized draft values. */
export function syncRawValuesWithDraft(
  draft: RecipeDraft,
  rawValues: Readonly<Record<string, string>>,
  invalidInputs: Readonly<Record<string, string>> = {},
): Record<string, string> {
  return Object.fromEntries(draft.ingredients.map(ingredient => {
    const raw = rawValues[ingredient.id];
    if (invalidInputs[ingredient.id] !== undefined) {
      return [ingredient.id, raw ?? String(ingredient.value)];
    }
    if (raw !== undefined) {
      try {
        const value = parseDecimal(raw);
        editIngredient(draft, ingredient.id, { value });
      } catch {
        return [ingredient.id, raw];
      }
    }
    return [ingredient.id, String(ingredient.value)];
  }));
}

/** Refuse mode conversion while any visible numeric field is invalid or unfinished. */
export function draftWithRawValues(
  draft: RecipeDraft,
  rawValues: Readonly<Record<string, string>>,
  invalidInputs: Readonly<Record<string, string>> = {},
): RecipeDraft {
  const error = Object.values(invalidInputs)[0];
  if (error !== undefined) throw new RecipeValidationError(error);
  return {
    ...draft,
    ingredients: draft.ingredients.map(ingredient => ({
      ...ingredient,
      value: parseDecimal(rawValues[ingredient.id] ?? String(ingredient.value)),
    })),
  };
}

/** Restore the most useful entry mode without inventing grams for percent-only formulas. */
export function recipeDraftFromSaved(recipe: SavedRecipe): RecipeEditorModel {
  const baseGrams = recipe.baseGrams;
  const hasCompleteGramContext = baseGrams !== undefined &&
    recipe.ingredients.every(ingredient => Object.hasOwn(baseGrams, ingredient.id));
  const mode = hasCompleteGramContext ? 'grams' : 'percent';
  const draft = createDraft(recipe.name, mode, recipe.ingredients.map(ingredient => ({
    id: ingredient.id,
    name: ingredient.name,
    isFlour: ingredient.isFlour,
    value: hasCompleteGramContext
      ? baseGrams![ingredient.id]
      : ingredient.percentage,
  })));
  const withContext = baseGrams === undefined ? draft : { ...draft, baseGrams: { ...baseGrams } };

  return {
    draft: withContext,
    rawValues: Object.fromEntries(withContext.ingredients.map(ingredient => [ingredient.id, String(ingredient.value)])),
  };
}

/** Validate the text fields at the explicit-save boundary and return the canonical formula. */
export function buildRecipeForSave(
  draft: RecipeDraft,
  rawValues: Readonly<Record<string, string>>,
  invalidInputs: Readonly<Record<string, string>> = {},
): Recipe {
  const error = Object.values(invalidInputs)[0];
  if (error !== undefined) throw new RecipeValidationError(error);
  return saveRecipe({
    ...draft,
    ingredients: draft.ingredients.map(ingredient => ({
      ...ingredient,
      value: parseDecimal(rawValues[ingredient.id] ?? String(ingredient.value)),
    })),
  });
}

/** Validate before the repository write so rejected fields cannot mutate the saved formula. */
export async function persistEditorDraft(
  repository: RecipeRepository,
  id: string,
  draft: RecipeDraft,
  rawValues: Readonly<Record<string, string>>,
  invalidInputs: Readonly<Record<string, string>> = {},
): Promise<Recipe> {
  const recipe = buildRecipeForSave(draft, rawValues, invalidInputs);
  await repository.save(id, recipe);
  return recipe;
}
