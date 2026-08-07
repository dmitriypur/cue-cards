import type { ConflictRepository, SyncConflictRecord } from '@/application/ports/ConflictRepository'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'
import type { SqlDriver, SqlRow, SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

type ConflictRow = SqlRow & {
  id: string
  aggregate_id: string
  operation_id: string
  local_snapshot: string
  server_snapshot: string
  created_at: string
}

export class SqliteConflictRepository implements ConflictRepository {
  private readonly driver: SqlDriver

  public constructor(driver: SqlDriver) { this.driver = driver }

  public async get(id: UUID, tx?: SqlTransaction): Promise<SyncConflictRecord | null> {
    const [row] = await (tx ?? this.driver).query<ConflictRow>(
      'SELECT * FROM sync_conflicts WHERE id = ? LIMIT 1', [id],
    )
    return row === undefined ? null : this.map(row)
  }

  public async list(): Promise<readonly SyncConflictRecord[]> {
    const rows = await this.driver.query<ConflictRow>(
      'SELECT * FROM sync_conflicts ORDER BY created_at, id',
    )
    return rows.map((row) => this.map(row))
  }

  public async save(conflict: SyncConflictRecord, tx?: SqlTransaction): Promise<void> {
    const executor = tx ?? this.driver
    await executor.run(
      `INSERT INTO sync_conflicts (
        id, aggregate_id, operation_id, local_snapshot, server_snapshot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(aggregate_id) DO UPDATE SET
        id = excluded.id, operation_id = excluded.operation_id,
        local_snapshot = excluded.local_snapshot, server_snapshot = excluded.server_snapshot,
        created_at = excluded.created_at`,
      [conflict.id, conflict.aggregateId, conflict.operationId,
        JSON.stringify(conflict.local), JSON.stringify(conflict.server), conflict.createdAt],
    )
    await executor.run("UPDATE scripts SET sync_status = 'conflict' WHERE id = ?", [conflict.aggregateId])
  }

  public async remove(id: UUID, tx?: SqlTransaction): Promise<void> {
    await (tx ?? this.driver).run('DELETE FROM sync_conflicts WHERE id = ?', [id])
  }

  private map(row: ConflictRow): SyncConflictRecord {
    return {
      id: row.id,
      aggregateId: row.aggregate_id,
      operationId: row.operation_id,
      local: JSON.parse(row.local_snapshot) as ScriptAggregate,
      server: JSON.parse(row.server_snapshot) as ScriptAggregate,
      createdAt: row.created_at,
    }
  }
}
