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
      trim_start_ms INTEGER,
      trim_end_ms INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      image_local_uri TEXT,
      image_path TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      achieved_at TEXT,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS playback_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      played_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
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

  // Best-effort column additions for dev databases created before this column existed.
  // No real users/devices exist yet, so a full migration framework would be premature —
  // this just keeps existing local dev data usable across schema tweaks pre-launch.
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(affirmations)`);
  const columnNames = new Set(columns.map((c) => c.name));
  if (!columnNames.has('trim_start_ms')) {
    await database.execAsync(`ALTER TABLE affirmations ADD COLUMN trim_start_ms INTEGER`);
  }
  if (!columnNames.has('trim_end_ms')) {
    await database.execAsync(`ALTER TABLE affirmations ADD COLUMN trim_end_ms INTEGER`);
  }
}

/**
 * Lazily opens (once) and migrates the on-device database. Safe to call repeatedly.
 * If opening/migrating fails, the failed attempt is not cached — the next call
 * retries from scratch instead of permanently failing for the rest of the session.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then(async (database) => {
        await initSchema(database);
        return database;
      })
      .catch((error: unknown) => {
        databasePromise = null;
        throw error;
      });
  }
  return databasePromise;
}
