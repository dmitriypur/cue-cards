import type { UUID } from '@/domain/scripts/types'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

export type RecordingMode = 'cues' | 'full'

export interface RecordingSession {
  readonly scriptId: UUID
  readonly currentCardId: UUID
  readonly mode: RecordingMode
  readonly fontScale: number
  readonly updatedAt: string
}

export interface RecordingSessionRepository {
  get(scriptId: UUID): Promise<RecordingSession | null>
  save(session: RecordingSession, tx?: SqlTransaction): Promise<void>
  remove(scriptId: UUID, tx?: SqlTransaction): Promise<void>
}
