import type {
  RecordingMode,
  RecordingSession,
  RecordingSessionRepository,
} from '@/application/ports/RecordingSessionRepository'
import type { UUID } from '@/domain/scripts/types'

export interface UpdateRecordingDisplayInput {
  readonly sessionId: UUID
  readonly mode: RecordingMode
  readonly fontScale: number
}

export class UpdateRecordingDisplay {
  private readonly sessions: RecordingSessionRepository
  private readonly clock: { now(): string }

  public constructor(
    sessions: RecordingSessionRepository,
    clock: { now(): string },
  ) {
    this.sessions = sessions
    this.clock = clock
  }

  public async execute(input: UpdateRecordingDisplayInput): Promise<RecordingSession> {
    if (!Number.isFinite(input.fontScale) || input.fontScale <= 0) {
      throw new Error('Font scale must be positive')
    }
    const session = await this.sessions.get(input.sessionId)
    if (session === null) throw new Error('Recording session not found')
    const nextSession: RecordingSession = {
      ...session,
      mode: input.mode,
      fontScale: input.fontScale,
      updatedAt: this.clock.now(),
    }
    await this.sessions.save(nextSession)
    return nextSession
  }
}
