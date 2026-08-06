import type { SqlDriver } from '@/infrastructure/sqlite/SqlDriver'

export const initialSchemaVersion = 1

export const initialSchemaSql = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_format TEXT NOT NULL CHECK (source_format IN ('markdown', 'text')),
  source_text TEXT NOT NULL,
  import_hash TEXT NOT NULL,
  server_version INTEGER NOT NULL DEFAULT 0 CHECK (server_version >= 0),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('local', 'pending', 'synced', 'conflict')),
  last_opened_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  title TEXT NOT NULL,
  full_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS cards_script_position_unique
  ON cards(script_id, position);

CREATE TABLE IF NOT EXISTS cue_sets (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL UNIQUE REFERENCES cards(id) ON DELETE CASCADE,
  cues TEXT NOT NULL,
  source_hash TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('missing', 'pending', 'generating', 'ready', 'stale', 'failed')),
  generation_id TEXT NULL,
  manually_edited INTEGER NOT NULL DEFAULT 0 CHECK (manually_edited IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_commands (
  operation_id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  base_version INTEGER NOT NULL CHECK (base_version >= 0),
  type TEXT NOT NULL CHECK (type IN ('script.replace')),
  payload TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'in_flight')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS outbox_state_created_index
  ON outbox_commands(state, created_at);

CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cursor TEXT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recording_sessions (
  script_id TEXT PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
  current_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('cues', 'full')),
  font_scale REAL NOT NULL CHECK (font_scale > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`

export async function migrateInitialSchema(driver: SqlDriver): Promise<void> {
  await driver.execute('PRAGMA foreign_keys = ON')
  await driver.transaction(async (tx) => {
    await tx.execute(initialSchemaSql)
    await tx.run(
      `INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
      [initialSchemaVersion, new Date().toISOString()],
    )
  })
}
