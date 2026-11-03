import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createRecipeRepository, RepositoryError, type SqlitePort } from '../src/storage/recipeRepository.ts';
import type { Recipe } from '../src/domain/recipe.ts';

class MemorySQLite implements SqlitePort {
  readonly database = new DatabaseSync(':memory:');
  failNext: 'all' | 'run' | null = null;

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async runAsync(sql: string, ...params: (string | number | null | Uint8Array)[]): Promise<{ changes: number; lastInsertRowId: number }> {
    if (this.failNext === 'run') {
      this.failNext = null;
      throw new Error('simulated write failure');
    }
    const result = this.database.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getAllAsync<T>(sql: string, ...params: (string | number | null | Uint8Array)[]): Promise<T[]> {
    if (this.failNext === 'all') {
      this.failNext = null;
      throw new Error('simulated read failure');
    }
    return this.database.prepare(sql).all(...params) as T[];
  }

  async getFirstAsync<T>(sql: string, ...params: (string | number | null | Uint8Array)[]): Promise<T | null> {
    const row = this.database.prepare(sql).get(...params);
    return row === undefined ? null : row as T;
  }

  async withExclusiveTransactionAsync(task: (transaction: SqlitePort) => Promise<void>): Promise<void> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      await task(this);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}

const flourRecipe = (name = 'Pan'): Recipe => ({
  name,
  ingredients: [
    { id: 'flour', name: 'Harina', isFlour: true, percentage: 100 },
    { id: 'water', name: 'Agua', isFlour: false, percentage: 70 },
  ],
});

function setup() {
  const database = new MemorySQLite();
  const repository = createRecipeRepository(database);
  return { database, repository };
}

test('S6: initializes a local empty recipe list without seeding sample data', async () => {
  const { database, repository } = setup();
  try {
    await repository.initialize();
    await repository.initialize();
    assert.deepEqual(await repository.list(), []);
  } finally {
    database.close();
  }
});

test('S6/S7: saves valid recipes and survives repository re-open with parameterized values', async () => {
  const { database, repository } = setup();
  try {
    await repository.initialize();
    const id = "id' OR 1=1 --";
    await repository.save(id, flourRecipe("Pan d'agua"));
    const reopened = createRecipeRepository(database);
    await reopened.initialize();
    assert.deepEqual(await reopened.get(id), { id, ...flourRecipe("Pan d'agua") });
    assert.deepEqual(await reopened.list(), [{ id, ...flourRecipe("Pan d'agua") }]);
  } finally {
    database.close();
  }
});

test('S7: updates only the chosen recipe and rejects invalid formulas without mutation', async () => {
  const { database, repository } = setup();
  try {
    await repository.initialize();
    await repository.save('first', flourRecipe('First'));
    await repository.save('second', flourRecipe('Second'));
    await repository.save('first', flourRecipe('Updated'));
    const beforeInvalid = await repository.list();
    await assert.rejects(repository.save('invalid', {
      name: 'Invalid',
      ingredients: [{ id: 'salt', name: 'Sal', isFlour: false, percentage: 2 }],
    }));
    await assert.rejects(repository.save(' ', flourRecipe()), (error: unknown) => error instanceof RepositoryError && error.code === 'invalid_id');
    assert.deepEqual(await repository.list(), beforeInvalid);
    assert.equal((await repository.get('first'))?.name, 'Updated');
    assert.equal((await repository.get('second'))?.name, 'Second');
  } finally {
    database.close();
  }
});

test('S8: deletes only the requested recipe; missing IDs and failed writes leave data intact', async () => {
  const { database, repository } = setup();
  try {
    await repository.initialize();
    await repository.save('first', flourRecipe('First'));
    await repository.save('second', flourRecipe('Second'));
    const before = await repository.list();
    database.failNext = 'run';
    await assert.rejects(repository.save('first', flourRecipe('Should not replace')), (error: unknown) => error instanceof RepositoryError && error.code === 'storage_failure');
    assert.deepEqual(await repository.list(), before);
    database.failNext = 'run';
    await assert.rejects(repository.delete('first'), (error: unknown) => error instanceof RepositoryError && error.code === 'storage_failure');
    assert.deepEqual(await repository.list(), before);
    await assert.rejects(repository.delete('missing'), (error: unknown) => error instanceof RepositoryError && error.code === 'not_found');
    assert.deepEqual(await repository.list(), before);
    await repository.delete('first');
    assert.deepEqual(await repository.list(), [before[1]]);
    await assert.rejects(repository.get('first'), (error: unknown) => error instanceof RepositoryError && error.code === 'not_found');
  } finally {
    database.close();
  }
});

test('S6: reports database read errors without replacing stored data or seeding defaults', async () => {
  const { database, repository } = setup();
  try {
    await repository.initialize();
    await repository.save('stored', flourRecipe());
    database.failNext = 'all';
    await assert.rejects(repository.list(), (error: unknown) => error instanceof RepositoryError && error.code === 'storage_failure');
    assert.deepEqual(await repository.list(), [{ id: 'stored', ...flourRecipe() }]);
  } finally {
    database.close();
  }
});

test('S6: reports corrupt stored recipes instead of silently discarding or replacing them', async () => {
  const { database, repository } = setup();
  try {
    await repository.initialize();
    await repository.save('valid', flourRecipe());
    await database.runAsync('INSERT INTO recipes (id, recipe_json) VALUES (?, ?)', 'broken', '{');
    await assert.rejects(repository.list(), (error: unknown) => error instanceof RepositoryError && error.code === 'corrupt_data');
    assert.deepEqual(await repository.get('valid'), { id: 'valid', ...flourRecipe() });
    await database.runAsync(
      'INSERT INTO recipes (id, recipe_json) VALUES (?, ?)',
      'bad-flag',
      JSON.stringify({
        name: 'Pan',
        ingredients: [{ id: 'flour', name: 'Harina', isFlour: 'false', percentage: 100 }],
      }),
    );
    await assert.rejects(repository.get('bad-flag'), (error: unknown) => error instanceof RepositoryError && error.code === 'corrupt_data');
  } finally {
    database.close();
  }
});

test('S6: rejects a database schema newer than this app without overwriting it', async () => {
  const { database, repository } = setup();
  try {
    database.database.exec('PRAGMA user_version = 2');
    await assert.rejects(repository.initialize(), (error: unknown) => error instanceof RepositoryError && error.code === 'unsupported_schema');
    await assert.rejects(repository.initialize(), (error: unknown) => error instanceof RepositoryError && error.code === 'unsupported_schema');
  } finally {
    database.close();
  }
});
