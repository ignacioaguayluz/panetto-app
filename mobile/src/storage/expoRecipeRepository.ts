import * as SQLite from 'expo-sqlite';
import { createRecipeRepository, type RecipeRepository, type SqlitePort, type SqliteValue } from './recipeRepository';

function adaptDatabase(database: SQLite.SQLiteDatabase): SqlitePort {
  return {
    execAsync: sql => database.execAsync(sql),
    runAsync: (sql, ...params) => database.runAsync(sql, ...params as SqliteValue[]),
    getAllAsync: <T>(sql: string, ...params: SqliteValue[]) => database.getAllAsync<T>(sql, ...params),
    getFirstAsync: <T>(sql: string, ...params: SqliteValue[]) => database.getFirstAsync<T>(sql, ...params),
    withExclusiveTransactionAsync: task => database.withExclusiveTransactionAsync(async transaction => {
      await task(adaptDatabase(transaction));
    }),
  };
}

/** Opens the per-device recipe database and initializes its schema before exposing CRUD operations. */
export async function openExpoRecipeRepository(databaseName = 'panetto.db'): Promise<RecipeRepository> {
  const database = await SQLite.openDatabaseAsync(databaseName);
  const repository = createRecipeRepository(adaptDatabase(database));
  await repository.initialize();
  return repository;
}
