import {
  createDraft,
  parseDecimal,
  saveRecipe,
  type Recipe,
  type RecipeDraft,
} from '../domain/recipe.ts';
import type { SavedRecipe } from '../storage/recipeRepository.ts';

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
): Recipe {
  return saveRecipe({
    ...draft,
    ingredients: draft.ingredients.map(ingredient => ({
      ...ingredient,
      value: parseDecimal(rawValues[ingredient.id] ?? String(ingredient.value)),
    })),
  });
}
