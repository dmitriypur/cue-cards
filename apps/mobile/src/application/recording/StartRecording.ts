import type {
  RecordingMode,
  RecordingSession,
  RecordingSessionRepository,
} from '@/application/ports/RecordingSessionRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { WakeLock } from '@/application/ports/WakeLock'
import type { UUID } from '@/domain/scripts/types'

export interface StartRecordingInput {
  readonly scriptId: UUID
  readonly cardId: UUID
  readonly mode: RecordingMode
  readonly fontScale: number
}

export class StartRecording {
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

  public async execute(input: StartRecordingInput): Promise<RecordingSession> {
    const script = await this.scripts.get(input.scriptId)
    if (script === null || script.deletedAt !== null) throw new Error('Script not found')
    if (!Number.isFinite(input.fontScale) || input.fontScale <= 0) {
      throw new Error('Font scale must be positive')
    }
    const card = script.cards.find(({ id, deletedAt }) => id === input.cardId && deletedAt === null)
    if (card === undefined) throw new Error('Card not found')

    const session: RecordingSession = {
      scriptId: script.id,
      currentCardId: card.id,
      mode: input.mode,
      fontScale: input.fontScale,
      updatedAt: this.clock.now(),
    }
    await this.sessions.save(session)
    await this.wakeLock.acquire()
    return session
  }
}
