import { describe, expect, it } from 'vitest'

import { FinishRecording } from '@/application/recording/FinishRecording'
import { MoveRecordingCursor } from '@/application/recording/MoveRecordingCursor'
import { StartRecording } from '@/application/recording/StartRecording'
import { UpdateRecordingDisplay } from '@/application/recording/UpdateRecordingDisplay'
import type {
  RecordingSession,
  RecordingSessionRepository,
} from '@/application/ports/RecordingSessionRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { WakeLock } from '@/application/ports/WakeLock'
import type { ScriptAggregate, ScriptCard } from '@/domain/scripts/types'

const startedAt = '2026-08-06T11:00:00.000Z'
const movedAt = '2026-08-06T11:01:00.000Z'

function card(id: string, position: number): ScriptCard {
  return {
    id,
    scriptId: 'script-1',
    position,
    title: `Карточка ${position + 1}`,
    fullText: `Полный текст ${position + 1}`,
    contentHash: `hash-${id}`,
    version: 0,
    cueSet: {
      id: `cue-${id}`,
      cardId: id,
      cues: ['Первый тезис', 'Второй тезис', 'Третий тезис'],
      sourceHash: `hash-${id}`,
      status: 'ready',
      generationId: null,
      manuallyEdited: false,
      version: 0,
      createdAt: startedAt,
      updatedAt: startedAt,
    },
    createdAt: startedAt,
    updatedAt: startedAt,
    deletedAt: null,
  }
}

const script: ScriptAggregate = {
  id: 'script-1',
  title: 'Сценарий',
  sourceFormat: 'markdown',
  sourceText: '# Сценарий',
  importHash: 'import-hash',
  serverVersion: 0,
  syncStatus: 'local',
  cards: [card('card-a', 0), card('card-b', 1), card('card-c', 2)],
  lastOpenedAt: startedAt,
  createdAt: startedAt,
  updatedAt: startedAt,
  deletedAt: null,
}

class MemorySessions implements RecordingSessionRepository {
  public current: RecordingSession | null = null
  public saveCount = 0

  public async get(scriptId: string): Promise<RecordingSession | null> {
    return this.current?.scriptId === scriptId ? this.current : null
  }

  public async save(session: RecordingSession): Promise<void> {
    this.current = session
    this.saveCount += 1
  }

  public async remove(scriptId: string): Promise<void> {
    if (this.current?.scriptId === scriptId) this.current = null
  }
}

class MemoryWakeLock implements WakeLock {
  public acquisitions = 0
  public releases = 0

  public async acquire(): Promise<void> {
    this.acquisitions += 1
  }

  public async release(): Promise<void> {
    this.releases += 1
  }

  public takeWarning(): string | null {
    return null
  }
}

function harness() {
  const sessions = new MemorySessions()
  const wakeLock = new MemoryWakeLock()
  const scripts: ScriptRepository = {
    list: async () => [],
    get: async (id) => id === script.id ? script : null,
    save: async () => undefined,
    softDelete: async () => undefined,
  }

  return { sessions, wakeLock, scripts }
}

describe('recording session actions', () => {
  it('starts at the selected card with the selected mode and font scale', async () => {
    const context = harness()
    const action = new StartRecording(
      context.scripts,
      context.sessions,
      context.wakeLock,
      { now: () => startedAt },
    )

    const result = await action.execute({
      scriptId: script.id,
      cardId: 'card-b',
      mode: 'full',
      fontScale: 1.25,
    })

    expect(result).toEqual({
      scriptId: script.id,
      currentCardId: 'card-b',
      mode: 'full',
      fontScale: 1.25,
      updatedAt: startedAt,
    })
    expect(context.sessions.current).toEqual(result)
    expect(context.wakeLock.acquisitions).toBe(1)
  })

  it('persists clamped previous and next navigation in card order', async () => {
    const context = harness()
    context.sessions.current = {
      scriptId: script.id,
      currentCardId: 'card-b',
      mode: 'cues',
      fontScale: 1,
      updatedAt: startedAt,
    }
    const action = new MoveRecordingCursor(
      context.scripts,
      context.sessions,
      context.wakeLock,
      { now: () => movedAt },
    )

    const previous = await action.execute({ sessionId: script.id, direction: 'previous' })
    const clamped = await action.execute({ sessionId: script.id, direction: 'previous' })

    expect(previous.currentCardId).toBe('card-a')
    expect(clamped.currentCardId).toBe('card-a')
    expect(clamped.updatedAt).toBe(movedAt)
    expect(context.sessions.saveCount).toBe(2)
  })

  it('persists one global mode and font scale without changing the cursor', async () => {
    const context = harness()
    context.sessions.current = {
      scriptId: script.id,
      currentCardId: 'card-c',
      mode: 'cues',
      fontScale: 1,
      updatedAt: startedAt,
    }
    const action = new UpdateRecordingDisplay(context.sessions, { now: () => movedAt })

    const result = await action.execute({
      sessionId: script.id,
      mode: 'full',
      fontScale: 1.4,
    })

    expect(result).toEqual({
      scriptId: script.id,
      currentCardId: 'card-c',
      mode: 'full',
      fontScale: 1.4,
      updatedAt: movedAt,
    })
    expect(await context.sessions.get(script.id)).toEqual(result)
  })

  it('removes the session and releases the wake lock on normal finish', async () => {
    const context = harness()
    context.sessions.current = {
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'cues',
      fontScale: 1,
      updatedAt: startedAt,
    }

    await new FinishRecording(context.sessions, context.wakeLock).execute(script.id)

    expect(context.sessions.current).toBeNull()
    expect(context.wakeLock.releases).toBe(1)
  })

  it('releases the wake lock when navigation persistence fails', async () => {
    const context = harness()
    context.sessions.current = {
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'cues',
      fontScale: 1,
      updatedAt: startedAt,
    }
    context.sessions.save = async () => { throw new Error('local write failed') }
    const action = new MoveRecordingCursor(
      context.scripts,
      context.sessions,
      context.wakeLock,
      { now: () => movedAt },
    )

    await expect(action.execute({ sessionId: script.id, direction: 'next' }))
      .rejects.toThrow('local write failed')
    expect(context.wakeLock.releases).toBe(1)
  })

  it('keeps the selected cue preference for a non-ready starting card', async () => {
    const context = harness()
    const staleScript: ScriptAggregate = {
      ...script,
      cards: script.cards.map((item) => item.id === 'card-b'
        ? {
            ...item,
            cueSet: {
              ...item.cueSet,
              status: 'stale',
              manuallyEdited: true,
              sourceHash: 'old-hash',
            },
          }
        : item),
    }
    context.scripts.get = async () => staleScript
    const start = new StartRecording(
      context.scripts,
      context.sessions,
      context.wakeLock,
      { now: () => startedAt },
    )

    const defaulted = await start.execute({
      scriptId: script.id,
      cardId: 'card-b',
      mode: 'cues',
      fontScale: 1,
    })
    expect(defaulted.mode).toBe('cues')
  })

  it('keeps the global cue preference when navigation reaches a non-ready card', async () => {
    const context = harness()
    const pendingScript: ScriptAggregate = {
      ...script,
      cards: script.cards.map((item) => item.id === 'card-b'
        ? { ...item, cueSet: { ...item.cueSet, cues: [], status: 'pending' } }
        : item),
    }
    context.scripts.get = async () => pendingScript
    context.sessions.current = {
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'cues',
      fontScale: 1,
      updatedAt: startedAt,
    }
    const move = new MoveRecordingCursor(
      context.scripts,
      context.sessions,
      context.wakeLock,
      { now: () => movedAt },
    )

    const result = await move.execute({ sessionId: script.id, direction: 'next' })

    expect(result.currentCardId).toBe('card-b')
    expect(result.mode).toBe('cues')
  })
})
