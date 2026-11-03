/** Pure recipe rules. Draft operations return new values; only saveRecipe produces a validated formula. */
export type EntryMode = 'grams' | 'percent';
export interface DraftIngredient {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly isFlour: boolean;
}
export interface RecipeDraft {
  readonly name: string;
  readonly mode: EntryMode;
  readonly ingredients: readonly DraftIngredient[];
  /** Editing context only, never a second formula. Present only in percent mode. */
  readonly baseGrams?: Readonly<Record<string, number>>;
}
export interface Recipe {
  readonly name: string;
  readonly ingredients: readonly {
    readonly id: string;
    readonly name: string;
    readonly isFlour: boolean;
    readonly percentage: number;
  }[];
  readonly baseGrams?: Readonly<Record<string, number>>;
}
export interface Production {
  readonly totalGrams: number;
  readonly ingredients: readonly { readonly id: string; readonly name: string; readonly grams: number }[];
}
export class RecipeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeValidationError';
  }
}
function requireRule(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RecipeValidationError(message);
}
function nonnegative(value: number): void {
  requireRule(Number.isFinite(value) && value >= 0, 'Ingresa un valor finito mayor o igual a cero.');
}
function positive(value: number): void {
  requireRule(Number.isFinite(value) && value > 0, 'Ingresa un valor finito mayor que cero.');
}
function sum(values: readonly number[]): number {
  const result = values.reduce((total, value) => total + value, 0);
  requireRule(Number.isFinite(result), 'La cantidad es demasiado grande.');
  return result;
}
function flourTotal(ingredients: readonly DraftIngredient[]): number {
  return sum(ingredients.filter(i => i.isFlour).map(i => i.value));
}
function checkEntries(ingredients: readonly DraftIngredient[], mode: EntryMode): void {
  const ids = new Set<string>();
  for (const item of ingredients) {
    requireRule(item.id.trim().length > 0 && !ids.has(item.id), 'Cada ingrediente debe tener una identidad única.');
    ids.add(item.id);
    nonnegative(item.value);
    requireRule(mode !== 'percent' || !item.isFlour || item.value <= 100, 'El porcentaje de una harina debe estar entre 0 y 100.');
  }
}
function normalize(ingredients: readonly DraftIngredient[]): DraftIngredient[] {
  const total = flourTotal(ingredients);
  // Keep an invalid zero-flour draft editable, but never invent a positive flour base.
  return ingredients.map(i => ({ ...i, value: i.isFlour && total > 0 ? i.value / total * 100 : i.value }));
}
function gramsFor(ingredients: readonly DraftIngredient[], base: number): Record<string, number> {
  return Object.fromEntries(ingredients.map(i => {
    const grams = i.value / 100 * base;
    nonnegative(grams);
    return [i.id, grams];
  }));
}
function contextFlour(draft: RecipeDraft): number | undefined {
  if (!draft.baseGrams) return undefined;
  return sum(draft.ingredients.filter(i => i.isFlour).map(i => draft.baseGrams![i.id]));
}
function revised(draft: RecipeDraft, ingredients: readonly DraftIngredient[], formulaChanged: boolean): RecipeDraft {
  checkEntries(ingredients, draft.mode);
  const base = contextFlour(draft);
  return {
    name: draft.name,
    mode: draft.mode,
    ingredients: ingredients.map(i => ({ ...i })),
    ...(draft.mode === 'percent' && base !== undefined && base > 0 && flourTotal(ingredients) > 0 ? {
      baseGrams: formulaChanged ? gramsFor(ingredients, base) : { ...draft.baseGrams },
    } : {}),
  };
}

export function createDraft(name: string, mode: EntryMode, ingredients: readonly DraftIngredient[] = []): RecipeDraft {
  requireRule(mode === 'grams' || mode === 'percent', 'Selecciona gramos o porcentaje panadero.');
  checkEntries(ingredients, mode);
  return { name, mode, ingredients: mode === 'percent' ? normalize(ingredients) : ingredients.map(i => ({ ...i })) };
}

export function addIngredient(draft: RecipeDraft, ingredient: DraftIngredient): RecipeDraft {
  const ingredients = [...draft.ingredients, { ...ingredient }];
  checkEntries(ingredients, draft.mode);
  return revised(draft, draft.mode === 'percent' ? normalize(ingredients) : ingredients, true);
}

export function removeIngredient(draft: RecipeDraft, id: string): RecipeDraft {
  requireRule(draft.ingredients.some(i => i.id === id), 'No se encontró el ingrediente.');
  const ingredients = draft.ingredients.filter(i => i.id !== id);
  return revised(draft, draft.mode === 'percent' ? normalize(ingredients) : ingredients, true);
}

export function editIngredient(draft: RecipeDraft, id: string, changes: Partial<Pick<DraftIngredient, 'name' | 'value' | 'isFlour'>>): RecipeDraft {
  const old = draft.ingredients.find(i => i.id === id);
  requireRule(old !== undefined, 'No se encontró el ingrediente.');
  let ingredients = draft.ingredients.map(i => i.id === id ? { ...i, ...changes } : { ...i });
  checkEntries(ingredients, draft.mode);
  const updated = ingredients.find(i => i.id === id)!;
  const classificationChanged = old.isFlour !== updated.isFlour;
  if (draft.mode === 'percent') {
    if (classificationChanged) {
      ingredients = normalize(ingredients);
    } else if (updated.isFlour && changes.value !== undefined) {
      const others = ingredients.filter(i => i.isFlour && i.id !== id);
      const total = sum(others.map(i => i.value));
      ingredients = ingredients.map(i => {
        if (!i.isFlour) return i;
        if (i.id === id) return { ...i, value: others.length === 0 ? 100 : updated.value };
        return { ...i, value: (100 - updated.value) * (total > 0 ? i.value / total : 1 / others.length) };
      });
    }
  }
  return revised(draft, ingredients, classificationChanged || changes.value !== undefined);
}

/** Switching a percent-only recipe to grams requires an explicit positive total flour mass. */
export function switchMode(draft: RecipeDraft, mode: EntryMode, baseFlourGrams?: number): RecipeDraft {
  requireRule(mode === 'grams' || mode === 'percent', 'Selecciona gramos o porcentaje panadero.');
  if (mode === draft.mode) return revised(draft, draft.ingredients, false);
  const recipe = saveRecipe(draft);
  if (mode === 'percent') {
    return {
      name: draft.name, mode,
      ingredients: recipe.ingredients.map(({ percentage, ...i }) => ({ ...i, value: percentage })),
      baseGrams: { ...recipe.baseGrams },
    };
  }
  if (baseFlourGrams !== undefined) positive(baseFlourGrams);
  requireRule(baseFlourGrams !== undefined || draft.baseGrams !== undefined, 'Ingresa la harina total base en gramos.');
  const grams = baseFlourGrams === undefined ? draft.baseGrams! : gramsFor(draft.ingredients, baseFlourGrams);
  return createDraft(draft.name, 'grams', draft.ingredients.map(i => ({ ...i, value: grams[i.id] })));
}

export function saveRecipe(draft: RecipeDraft): Recipe {
  requireRule(draft.name.trim().length > 0, 'Ingresa el nombre de la receta.');
  checkEntries(draft.ingredients, draft.mode);
  for (const item of draft.ingredients) requireRule(item.name.trim().length > 0, 'Ingresa el nombre de cada ingrediente.');
  const total = flourTotal(draft.ingredients);
  requireRule(total > 0, 'Agrega al menos una harina con cantidad positiva.');
  if (draft.mode === 'percent') requireRule(Math.abs(total - 100) < 1e-8, 'Las harinas deben sumar 100 %.');
  const ingredients = draft.ingredients.map(({ value, ...i }) => {
    const percentage = draft.mode === 'grams' ? value / total * 100 : value;
    nonnegative(percentage);
    return { ...i, percentage };
  });
  sum(ingredients.map(i => i.percentage));
  const baseGrams = draft.mode === 'grams'
    ? Object.fromEntries(draft.ingredients.map(i => [i.id, i.value]))
    : draft.baseGrams && { ...draft.baseGrams };
  return { name: draft.name, ingredients, ...(baseGrams ? { baseGrams } : {}) };
}

/** Accept one decimal separator, never grouping separators or exponent notation. */
export function parseDecimal(text: string): number {
  const trimmed = text.trim();
  requireRule(/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(trimmed), 'Ingresa un número válido, con coma o punto decimal y sin separadores de miles.');
  const value = Number(trimmed.replace(',', '.'));
  nonnegative(value);
  return value;
}

export function calculateProduction(source: Recipe | RecipeDraft, pieceCount: number, gramsPerPiece: number): Production {
  requireRule(Number.isInteger(pieceCount) && pieceCount > 0, 'La cantidad de piezas debe ser un entero mayor que cero.');
  positive(gramsPerPiece);
  const totalGrams = pieceCount * gramsPerPiece;
  positive(totalGrams);
  // Validate canonical input as well as drafts; do not normalize a malformed saved formula silently.
  const recipe = 'mode' in source ? saveRecipe(source) : saveRecipe({
    name: source.name, mode: 'percent',
    ingredients: source.ingredients.map(({ percentage, ...i }) => ({ ...i, value: percentage })),
  });
  const totalPercent = sum(recipe.ingredients.map(i => i.percentage));
  const ingredients = recipe.ingredients.map(i => {
    const grams = totalGrams * (i.percentage / totalPercent);
    nonnegative(grams);
    return { id: i.id, name: i.name, grams };
  });
  return { totalGrams, ingredients };
}

/** Presentation only: the formula and production retain full internal precision. */
export function formatGrams(grams: number): string {
  nonnegative(grams);
  return new Intl.NumberFormat('es', { maximumFractionDigits: 2, useGrouping: false }).format(grams);
}
