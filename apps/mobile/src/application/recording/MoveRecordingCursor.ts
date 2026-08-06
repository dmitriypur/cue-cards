import type { RecordingSession, RecordingSessionRepository } from '@/application/ports/RecordingSessionRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { WakeLock } from '@/application/ports/WakeLock'
import type { UUID } from '@/domain/scripts/types'

export interface MoveRecordingCursorInput {
  readonly sessionId: UUID
  readonly direction: 'previous' | 'next'
}

export class MoveRecordingCursor {
  private readonly scripts: ScriptRepository
  private readonly sessions: RecordingSessionRepository
  private readonly wakeLock: WakeLock
  private readonly clock: { now(): string }

  public constructor(
    scripts: ScriptRepository,
    sessions: RecordingSessionRepository,
    wakeLock: WakeLock,
    clock: { now(): string },
  ) {
    this.scripts = scripts
    this.sessions = sessions
    this.wakeLock = wakeLock
    this.clock = clock
  }

  public async execute(input: MoveRecordingCursorInput): Promise<RecordingSession> {
    try {
      const session = await this.sessions.get(input.sessionId)
      if (session === null) throw new Error('Recording session not found')
      const script = await this.scripts.get(session.scriptId)
      if (script === null || script.deletedAt !== null) throw new Error('Script not found')
      const cards = script.cards
        .filter(({ deletedAt }) => deletedAt === null)
        .sort((left, right) => left.position - right.position)
      const index = cards.findIndex(({ id }) => id === session.currentCardId)
      if (index < 0) throw new Error('Current card not found')
      const offset = input.direction === 'previous' ? -1 : 1
      const nextIndex = Math.min(Math.max(index + offset, 0), cards.length - 1)
      const nextCard = cards[nextIndex]
      if (nextCard === undefined) throw new Error('Script has no cards')

      const nextSession: RecordingSession = {
        ...session,
        currentCardId: nextCard.id,
        updatedAt: this.clock.now(),
      }
      await this.sessions.save(nextSession)
      return nextSession
    } catch (error) {
      await this.wakeLock.release()
      throw error
    }
  }
}
