import type {
  OutboxCommand,
  OutboxRepository,
  OutboxCommandState,
  OutboxCommandType,
  StoredOutboxCommand,
} from '@/application/ports/OutboxRepository'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'
import type { SqlDriver, SqlRow, SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

type OutboxRow = SqlRow & {
  operation_id: string
  aggregate_id: string
  base_version: number
  type: string
  payload: string
  state: string
  attempts: number
  next_attempt_at: string | null
  created_at: string
}

export class SqliteOutboxRepository implements OutboxRepository {
  private readonly driver: SqlDriver

  public constructor(driver: SqlDriver) {
    this.driver = driver
  }

  public async upsertLatestSnapshot(
    command: OutboxCommand,
    tx?: SqlTransaction,
  ): Promise<void> {
    const executor = tx ?? this.driver
    const [pending] = await executor.query<OutboxRow>(
      `SELECT * FROM outbox_commands
       WHERE aggregate_id = ? AND state = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [command.aggregateId],
    )

    if (pending !== undefined) {
      await executor.run(
        `UPDATE outbox_commands
         SET type = ?, payload = ?, next_attempt_at = NULL
         WHERE operation_id = ?`,
        [command.type, JSON.stringify(command.payload), pending.operation_id],
      )
      return
    }

    await executor.run(
      `INSERT INTO outbox_commands (
        operation_id, aggregate_id, base_version, type, payload, state,
        attempts, next_attempt_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, ?)`,
      [
        command.operationId,
        command.aggregateId,
        command.baseVersion,
        command.type,
        JSON.stringify(command.payload),
        command.createdAt,
      ],
    )
  }

  public async next(): Promise<StoredOutboxCommand | null> {
    const [row] = await this.driver.query<OutboxRow>(
      `SELECT * FROM outbox_commands
       WHERE state = 'pending'
         AND (next_attempt_at IS NULL OR next_attempt_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ORDER BY created_at, operation_id
       LIMIT 1`,
    )

    return row === undefined ? null : this.mapRow(row)
  }

  public async markInFlight(operationId: UUID): Promise<void> {
    await this.driver.run(
      `UPDATE outbox_commands
       SET state = 'in_flight', attempts = attempts + 1
       WHERE operation_id = ?`,
      [operationId],
    )
  }

  public async acknowledge(operationId: UUID, serverVersion: number): Promise<void> {
    await this.driver.transaction(async (tx) => {
      const [command] = await tx.query<OutboxRow>(
        'SELECT * FROM outbox_commands WHERE operation_id = ? LIMIT 1',
        [operationId],
      )

      if (command === undefined) {
        return
      }

      await tx.run('DELETE FROM outbox_commands WHERE operation_id = ?', [operationId])
      await tx.run(
        `UPDATE scripts
         SET server_version = ?,
             sync_status = CASE
               WHEN EXISTS (
                 SELECT 1 FROM outbox_commands WHERE aggregate_id = ?
               ) THEN 'pending'
               ELSE 'synced'
             END
         WHERE id = ?`,
        [serverVersion, command.aggregate_id, command.aggregate_id],
      )
      await tx.run(
        `UPDATE outbox_commands SET base_version = ?
         WHERE aggregate_id = ? AND state = 'pending'`,
        [serverVersion, command.aggregate_id],
      )
    })
  }

  public async rebasePending(aggregateId: UUID, serverVersion: number): Promise<void> {
    await this.driver.run(
      `UPDATE outbox_commands SET base_version = ?
       WHERE aggregate_id = ? AND state = 'pending'`,
      [serverVersion, aggregateId],
    )
  }

  private mapRow(row: OutboxRow): StoredOutboxCommand {
    return {
      operationId: row.operation_id,
      aggregateId: row.aggregate_id,
      baseVersion: row.base_version,
      type: row.type as OutboxCommandType,
      payload: JSON.parse(row.payload) as ScriptAggregate,
      state: row.state as OutboxCommandState,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
      createdAt: row.created_at,
    }
  }
}
