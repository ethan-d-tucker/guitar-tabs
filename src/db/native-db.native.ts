import * as SQLite from 'expo-sqlite';

let db: any = null;

export async function getDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('guitar-tabs.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'chords',
      source_url TEXT,
      raw_content TEXT NOT NULL,
      transpose_offset INTEGER NOT NULL DEFAULT 0,
      capo INTEGER NOT NULL DEFAULT 0,
      tuning TEXT NOT NULL DEFAULT 'Standard',
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      annotations TEXT NOT NULL DEFAULT '{}'
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS setlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS setlist_songs (
      setlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      PRIMARY KEY (setlist_id, song_id),
      FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
  `);
  // Migration for existing databases that don't have the annotations column
  try {
    await db.execAsync(`ALTER TABLE songs ADD COLUMN annotations TEXT NOT NULL DEFAULT '{}'`);
  } catch {
    // Column already exists — safe to ignore
  }
  return db;
}
