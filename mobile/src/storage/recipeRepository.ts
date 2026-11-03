import { saveRecipe, type Recipe } from '../domain/recipe.ts';

export type SqliteValue = string | number | null | Uint8Array;
export interface SqlitePort {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqliteValue[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, ...params: SqliteValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqliteValue[]): Promise<T | null>;
  withExclusiveTransactionAsync(task: (transaction: SqlitePort) => Promise<void>): Promise<void>;
}

export interface SavedRecipe extends Recipe {
  readonly id: string;
}

export type RepositoryErrorCode = 'storage_failure' | 'not_found' | 'invalid_id' | 'corrupt_data' | 'unsupported_schema';
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

export interface RecipeRepository {
  initialize(): Promise<void>;
  list(): Promise<SavedRecipe[]>;
  get(id: string): Promise<SavedRecipe>;
  save(id: string, recipe: Recipe): Promise<void>;
  delete(id: string): Promise<void>;
}

const SCHEMA_VERSION = 1;
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_json TEXT NOT NULL
)`;

function wrapStorageError(error: unknown, message: string): RepositoryError {
  if (error instanceof RepositoryError) return error;
  return new RepositoryError('storage_failure', message, { cause: error });
}

function requireId(id: string): void {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new RepositoryError('invalid_id', 'La receta necesita un identificador válido.');
  }
}

function validateRecipe(recipe: Recipe): Recipe {
  try {
    if (!recipe || !Array.isArray(recipe.ingredients)) throw new Error('invalid recipe shape');
    const draft = {
      name: recipe.name,
      mode: 'percent' as const,
      ingredients: recipe.ingredients.map(ingredient => ({
        id: ingredient.id,
        name: ingredient.name,
        isFlour: ingredient.isFlour,
        value: ingredient.percentage,
      })),
      ...(recipe.baseGrams ? { baseGrams: { ...recipe.baseGrams } } : {}),
    };
    const validated = saveRecipe(draft);
    for (const grams of Object.values(validated.baseGrams ?? {})) {
      if (!Number.isFinite(grams) || grams < 0) throw new Error('invalid gram context');
    }
    return validated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    throw error;
  }
}

function decodeRow(row: { id: string; recipe_json: string }): SavedRecipe {
  try {
    if (typeof row.id !== 'string' || row.id.trim().length === 0 || typeof row.recipe_json !== 'string') {
      throw new Error('invalid row shape');
    }
    const parsed: unknown = JSON.parse(row.recipe_json);
    if (typeof parsed !== 'object' || parsed === null || !('name' in parsed) || !('ingredients' in parsed)) {
      throw new Error('invalid recipe shape');
    }
    const value = parsed as { name: unknown; ingredients: unknown; baseGrams?: unknown };
    if (typeof value.name !== 'string' || !Array.isArray(value.ingredients)) throw new Error('invalid recipe fields');
    for (const ingredient of value.ingredients) {
      if (typeof ingredient !== 'object' || ingredient === null || Array.isArray(ingredient)) {
        throw new Error('invalid ingredient shape');
      }
      const fields = ingredient as Record<string, unknown>;
      if (
        typeof fields.id !== 'string' ||
        typeof fields.name !== 'string' ||
        typeof fields.isFlour !== 'boolean' ||
        typeof fields.percentage !== 'number' ||
        !Number.isFinite(fields.percentage)
      ) {
        throw new Error('invalid ingredient fields');
      }
    }
    if (value.baseGrams !== undefined) {
      if (typeof value.baseGrams !== 'object' || value.baseGrams === null || Array.isArray(value.baseGrams)) {
        throw new Error('invalid gram context');
      }
      for (const grams of Object.values(value.baseGrams)) {
        if (typeof grams !== 'number' || !Number.isFinite(grams) || grams < 0) throw new Error('invalid gram context');
      }
    }
    const recipe = validateRecipe(value as Recipe);
    return { id: row.id, ...recipe };
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    throw new RepositoryError('corrupt_data', 'No se pudo leer una receta guardada porque sus datos están dañados.', { cause: error });
  }
}

export function createRecipeRepository(database: SqlitePort): RecipeRepository {
  let initialization: Promise<void> | undefined;

  const initialize = (): Promise<void> => {
    if (!initialization) {
      initialization = (async () => {
        const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        const version = row?.user_version ?? 0;
        if (version > SCHEMA_VERSION) {
          throw new RepositoryError('unsupported_schema', 'La base de recetas fue creada por una versión más nueva de Panetto.');
        }
        if (version === SCHEMA_VERSION) return;
        await database.withExclusiveTransactionAsync(async transaction => {
          await transaction.execAsync(CREATE_TABLE);
          await transaction.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        });
      })().catch(error => {
        initialization = undefined;
        throw wrapStorageError(error, 'No se pudo preparar el almacenamiento local de recetas.');
      });
    }
    return initialization;
  };

  const list = async (): Promise<SavedRecipe[]> => {
    await initialize();
    try {
      const rows = await database.getAllAsync<{ id: string; recipe_json: string }>(
        'SELECT id, recipe_json FROM recipes ORDER BY rowid ASC',
      );
      return rows.map(decodeRow);
    } catch (error) {
      throw wrapStorageError(error, 'No se pudieron leer las recetas guardadas.');
    }
  };

  const get = async (id: string): Promise<SavedRecipe> => {
    requireId(id);
    await initialize();
    try {
      const row = await database.getFirstAsync<{ id: string; recipe_json: string }>(
        'SELECT id, recipe_json FROM recipes WHERE id = ?', id,
      );
      if (!row) throw new RepositoryError('not_found', 'No se encontró la receta.');
      return decodeRow(row);
    } catch (error) {
      throw wrapStorageError(error, 'No se pudo leer la receta guardada.');
    }
  };

  const save = async (id: string, recipe: Recipe): Promise<void> => {
    requireId(id);
    const validated = validateRecipe(recipe);
    const recipeJson = JSON.stringify(validated);
    await initialize();
    try {
      await database.runAsync(
        `INSERT INTO recipes (id, recipe_json) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET recipe_json = excluded.recipe_json`,
        id,
        recipeJson,
      );
    } catch (error) {
      throw wrapStorageError(error, 'No se pudo guardar la receta. Tus datos anteriores siguen intactos.');
    }
  };

  const remove = async (id: string): Promise<void> => {
    requireId(id);
    await initialize();
    try {
      const result = await database.runAsync('DELETE FROM recipes WHERE id = ?', id);
      if (result.changes === 0) throw new RepositoryError('not_found', 'No se encontró la receta para eliminar.');
    } catch (error) {
      throw wrapStorageError(error, 'No se pudo eliminar la receta.');
    }
  };

  return { initialize, list, get, save, delete: remove };
}
