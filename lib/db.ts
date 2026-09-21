import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'anthaathi.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initSchema(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS affirmations (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      folder_id TEXT,
      title TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      storage_path TEXT,
      duration_ms INTEGER NOT NULL,
      source TEXT NOT NULL,
      voice_id TEXT,
      script_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      row_id TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

/** Lazily opens (once) and migrates the on-device database. Safe to call repeatedly. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await initSchema(database);
      return database;
    });
  }
  return databasePromise;
}
