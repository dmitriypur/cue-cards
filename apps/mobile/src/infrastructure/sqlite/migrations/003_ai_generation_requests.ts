import type { SqlDriver } from '@/infrastructure/sqlite/SqlDriver'

export const aiGenerationRequestsSchemaVersion = 3

export const aiGenerationRequestsSchemaSql = `
CREATE TABLE IF NOT EXISTS ai_generation_requests (
  scope_key TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  card_id TEXT NULL REFERENCES cards(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  local_prepared INTEGER NOT NULL DEFAULT 0 CHECK (local_prepared IN (0, 1)),
  replace_manual INTEGER NOT NULL DEFAULT 0 CHECK (replace_manual IN (0, 1)),
  generation_id TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_generation_requests_generation_index
  ON ai_generation_requests(generation_id);
`

export async function migrateAiGenerationRequests(driver: SqlDriver): Promise<void> {
  await driver.transaction(async (tx) => {
    await tx.execute(aiGenerationRequestsSchemaSql)
    await tx.run(
      'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [aiGenerationRequestsSchemaVersion, new Date().toISOString()],
    )
  })
}
