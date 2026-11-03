# Recipe domain (S2–S5)

Pure TypeScript; no storage, UI, IDs generated internally, or cached production results.
Callers supply stable, unique ingredient IDs and manually set `isFlour` (including
for sourdough or preferments). Names never infer flour status or composition.

## Editing and saving

- `createDraft(name, 'grams' | 'percent', ingredients)` copies input. Each ingredient
  has `id`, `name`, `value`, and `isFlour`. Add/edit/remove return a new draft.
  To rename a recipe, copy the draft with its new `name`.
- Grams edits preserve every other weight. Percent edits redistribute other flours
  proportionally, or equally if their previous shares were all zero. One flour
  remains 100%. Add/remove/flour classification changes normalize percent flours;
  non-flours retain their values, including values above 100%.
- A draft may be empty or have no positive flour while being edited. `saveRecipe`
  and `calculateProduction` reject it. Invalid numeric edits throw
  `RecipeValidationError` without mutating any supplied object.
- `saveRecipe` returns canonical baker percentages. Optional `baseGrams` is only
  editing context: original grams are retained, and subsequent percent edits
  derive new grams from the previous total flour base. Losing all positive flour
  discards that context rather than inventing a new base.
- `switchMode(draft, 'grams', totalFlourGrams?)` requires a positive explicit flour
  base when none exists; percent-only recipes need no gram base for saving or
  scaling. `switchMode(draft, 'percent')` derives percentages from grams.
- `parseDecimal` accepts comma or point as the decimal separator, without grouping,
  exponents, signs, or mixed separators. Thus `1,234` means 1.234, never 1234.

## Production

`calculateProduction(recipeOrDraft, pieceCount, gramsPerPiece)` scales against the
sum of **all** percentages, not flour alone. Pieces must be a positive integer;
raw dough grams per piece must be positive and finite. Tiny batches are allowed.
Calculations retain floating-point precision; `formatGrams` alone rounds to at
most two decimals, with a Spanish decimal comma and no grouping. Displayed sums
may differ slightly from the target. There is no baked yield or hydration claim.

The UI must call calculation only on explicit “Calcular”, invalidate displayed
results when inputs change, and present validation errors. This module does not
store prior results, persist recipes, or control navigation.

## Verification

From `mobile/`, using the existing Node 24 and TypeScript toolchain:

- `npm run test:domain`: dependency-free Node tests with TypeScript stripping.
- `npm run typecheck:domain`: strict no-emit check of domain and tests. Uses Node
  types already available through the Expo toolchain; installs nothing.

Node may emit `MODULE_TYPELESS_PACKAGE_JSON` when reparsing the TypeScript tests
as ESM. It is harmless; the app's module configuration is intentionally unchanged.
