import type { RecordingSessionRepository } from '@/application/ports/RecordingSessionRepository'
import type { WakeLock } from '@/application/ports/WakeLock'
import type { UUID } from '@/domain/scripts/types'

export class FinishRecording {
  private readonly sessions: RecordingSessionRepository
  private readonly wakeLock: WakeLock

  public constructor(
    sessions: RecordingSessionRepository,
    wakeLock: WakeLock,
  ) {
    this.sessions = sessions
    this.wakeLock = wakeLock
  }

  public async execute(sessionId: UUID): Promise<void> {
    try {
      await this.sessions.remove(sessionId)
    } finally {
      await this.wakeLock.release()
    }
  }
}
