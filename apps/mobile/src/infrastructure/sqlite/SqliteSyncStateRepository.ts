import type { SyncStateRepository } from '@/application/ports/SyncStateRepository'
import type { SqlDriver, SqlRow, SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

type CursorRow = SqlRow & { cursor: string | null }

export class SqliteSyncStateRepository implements SyncStateRepository {
  private readonly driver: SqlDriver

  public constructor(driver: SqlDriver) {
    this.driver = driver
  }

  public async cursor(): Promise<number> {
    const [row] = await this.driver.query<CursorRow>(
      'SELECT cursor FROM sync_state WHERE id = 1 LIMIT 1',
    )
    if (row?.cursor === null || row?.cursor === undefined) return 0
    const cursor = Number(row.cursor)
    return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0
  }

  public async setCursor(cursor: number, tx?: SqlTransaction): Promise<void> {
    await (tx ?? this.driver).run(
      `INSERT INTO sync_state (id, cursor, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`,
      [String(cursor), new Date().toISOString()],
    )
  }
}
