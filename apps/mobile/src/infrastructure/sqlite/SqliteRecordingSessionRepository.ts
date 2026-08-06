import type {
  RecordingMode,
  RecordingSession,
  RecordingSessionRepository,
} from '@/application/ports/RecordingSessionRepository'
import type { UUID } from '@/domain/scripts/types'
import type { SqlDriver, SqlRow, SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

type RecordingSessionRow = SqlRow & {
  script_id: string
  current_card_id: string
  mode: string
  font_scale: number
  updated_at: string
}

export class SqliteRecordingSessionRepository implements RecordingSessionRepository {
  private readonly driver: SqlDriver

  public constructor(driver: SqlDriver) {
    this.driver = driver
  }

  public async get(scriptId: UUID): Promise<RecordingSession | null> {
    const [row] = await this.driver.query<RecordingSessionRow>(
      'SELECT * FROM recording_sessions WHERE script_id = ? LIMIT 1',
      [scriptId],
    )

    if (row === undefined) {
      return null
    }

    return {
      scriptId: row.script_id,
      currentCardId: row.current_card_id,
      mode: row.mode as RecordingMode,
      fontScale: row.font_scale,
      updatedAt: row.updated_at,
    }
  }

  public async save(session: RecordingSession, tx?: SqlTransaction): Promise<void> {
    const executor = tx ?? this.driver
    await executor.run(
      `INSERT INTO recording_sessions (
        script_id, current_card_id, mode, font_scale, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(script_id) DO UPDATE SET
        current_card_id = excluded.current_card_id,
        mode = excluded.mode,
        font_scale = excluded.font_scale,
        updated_at = excluded.updated_at`,
      [
        session.scriptId,
        session.currentCardId,
        session.mode,
        session.fontScale,
        session.updatedAt,
      ],
    )
  }

  public async remove(scriptId: UUID, tx?: SqlTransaction): Promise<void> {
    await (tx ?? this.driver).run('DELETE FROM recording_sessions WHERE script_id = ?', [scriptId])
  }
}
