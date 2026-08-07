import type { SqlDriver } from '@/infrastructure/sqlite/SqlDriver'

export const syncConflictsSchemaVersion = 2

export const syncConflictsSchemaSql = `
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  local_snapshot TEXT NOT NULL,
  server_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sync_conflicts_aggregate_unique
  ON sync_conflicts(aggregate_id);
`

export async function migrateSyncConflicts(driver: SqlDriver): Promise<void> {
  await driver.transaction(async (tx) => {
    await tx.execute(syncConflictsSchemaSql)
    await tx.run(
      'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [syncConflictsSchemaVersion, new Date().toISOString()],
    )
  })
}
