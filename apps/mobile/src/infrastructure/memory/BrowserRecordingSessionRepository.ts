import type {
  RecordingSession,
  RecordingSessionRepository,
} from '@/application/ports/RecordingSessionRepository'
import type { UUID } from '@/domain/scripts/types'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

const STORAGE_KEY = 'cue_cards.e2e.recording_sessions'

export class BrowserRecordingSessionRepository implements RecordingSessionRepository {
  public async get(scriptId: UUID): Promise<RecordingSession | null> {
    return this.readAll().find((session) => session.scriptId === scriptId) ?? null
  }

  public async save(session: RecordingSession, _tx?: SqlTransaction): Promise<void> {
    const sessions = this.readAll().filter(({ scriptId }) => scriptId !== session.scriptId)
    sessions.push(session)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  }

  public async remove(scriptId: UUID, _tx?: SqlTransaction): Promise<void> {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(this.readAll().filter((session) => session.scriptId !== scriptId)),
    )
  }

  private readAll(): RecordingSession[] {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === null) return []
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as RecordingSession[] : []
  }
}
