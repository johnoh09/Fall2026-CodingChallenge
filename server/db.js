import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const serverDir = dirname(fileURLToPath(import.meta.url));
export const samples = JSON.parse(readFileSync(resolve(serverDir, 'samples.json'), 'utf8'));

export function openDatabase(filename = resolve(serverDir, 'data/frameboard.sqlite')) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, password TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#dce5dc',
      share_token TEXT UNIQUE, share_mode TEXT NOT NULL DEFAULT 'private' CHECK(share_mode IN ('private','view','edit')),
      revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS members (
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY(board_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS pins (
      id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      image_id TEXT NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL, source_url TEXT NOT NULL, author TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(board_id, image_id)
    );
    CREATE INDEX IF NOT EXISTS pins_board ON pins(board_id);
    CREATE INDEX IF NOT EXISTS boards_owner ON boards(owner_id);
    CREATE TABLE IF NOT EXISTS search_cache (key TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  `);
  return db;
}

export function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function touchBoard(db, id) {
  db.prepare(
    'UPDATE boards SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).run(id);
}
