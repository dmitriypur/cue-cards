import { describe, expect, it } from 'vitest'

import { StartCardCueGeneration } from '@/application/ai/StartCardCueGeneration'
import { StartScriptCueGeneration } from '@/application/ai/StartScriptCueGeneration'
import { RefreshGeneration } from '@/application/ai/RefreshGeneration'
import { ResumeAiGenerations } from '@/application/ai/ResumeAiGenerations'
import { ApiError } from '@/application/ports/ApiClient'
import type {
  AiGeneration,
  AiGenerationGateway,
} from '@/application/ports/AiGenerationGateway'
import type { AiGenerationRequest } from '@/application/ports/AiGenerationRequestRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { ScriptAggregate } from '@/domain/scripts/types'

const scriptId = '019b9ccb-3f71-7000-8000-000000000510'
const firstCardId = '019b9ccb-3f71-7000-8000-000000000511'
const secondCardId = '019b9ccb-3f71-7000-8000-000000000512'

const queuedGeneration: AiGeneration = {
  id: '019b9ccb-3f71-7000-8000-000000000520',
  scriptId,
  cardId: null,
  status: 'queued',
  completedCards: 0,
  totalCards: 2,
  error: null,
  createdAt: '2026-08-07T12:00:00.000Z',
  updatedAt: '2026-08-07T12:00:00.000Z',
}

function aggregate(): ScriptAggregate {
  const createdAt = '2026-08-07T11:00:00.000Z'
  return {
    id: scriptId,
    title: 'Синтетический сценарий',
    sourceFormat: 'markdown',
    sourceText: '# Синтетический сценарий',
    importHash: 'import-hash',
    serverVersion: 4,
    syncStatus: 'synced',
    cards: [
      {
        id: firstCardId,
        scriptId,
        position: 0,
        title: 'Первая карточка',
        fullText: 'Полный исходный текст первой карточки.',
        contentHash: 'first-hash',
        version: 2,
        cueSet: {
          id: '019b9ccb-3f71-7000-8000-000000000513',
          cardId: firstCardId,
          cues: [],
          sourceHash: null,
          status: 'missing',
          generationId: null,
          manuallyEdited: false,
          version: 0,
          createdAt,
          updatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      },
      {
        id: secondCardId,
        scriptId,
        position: 1,
        title: 'Вторая карточка',
        fullText: 'Полный исходный текст второй карточки.',
        contentHash: 'second-hash',
        version: 3,
        cueSet: {
          id: '019b9ccb-3f71-7000-8000-000000000514',
          cardId: secondCardId,
          cues: ['Ручной тезис один', 'Ручной тезис два', 'Ручной тезис три'],
          sourceHash: 'old-hash',
          status: 'stale',
          generationId: null,
          manuallyEdited: true,
          version: 2,
          createdAt,
          updatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      },
    ],
    lastOpenedAt: null,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  }
}

class MemoryHarness {
  public script = aggregate()
  public online = true
  public readonly events: string[] = []
  public startError: Error | null = null
  public generation = queuedGeneration
  public syncState: 'up-to-date' | 'retrying' | 'auth-required' | 'conflict' = 'up-to-date'
  public readonly requestRows = new Map<string, AiGenerationRequest>()
  public readonly startedOperations: string[] = []

  public readonly scripts: ScriptRepository = {
    list: async () => [],
    get: async (id) => id === this.script.id ? this.script : null,
    save: async (next) => { this.script = next },
    softDelete: async () => undefined,
  }

  public readonly saver = {
    execute: async ({ aggregate: next }: { readonly aggregate: ScriptAggregate }) => {
      this.events.push('save')
      this.script = next
      return next
    },
  }

  public readonly connectivity = {
    current: async () => this.online,
    subscribe: () => () => undefined,
  }

  public readonly sync = {
    execute: async () => {
      this.events.push('sync')
      return { state: this.syncState, uploaded: 1, downloaded: 0 }
    },
  }

  public readonly gateway: AiGenerationGateway = {
    startScript: async (_scriptId, operationId) => {
      this.startedOperations.push(operationId)
      this.events.push('start-script')
      if (this.startError !== null) throw this.startError
      return this.generation
    },
    startCard: async (cardId, replaceManual, operationId) => {
      this.startedOperations.push(operationId)
      this.events.push(`start-card:${cardId}:${replaceManual}`)
      if (this.startError !== null) throw this.startError
      return { ...this.generation, cardId, totalCards: 1 }
    },
    get: async () => this.generation,
  }

  public readonly requests = {
    upsertPending: async (request: AiGenerationRequest) => {
      this.requestRows.set(request.scopeKey, { ...request, generationId: null })
    },
    markStarted: async (scopeKey: string, generationId: string) => {
      const request = this.requestRows.get(scopeKey)
      if (request !== undefined) this.requestRows.set(scopeKey, { ...request, generationId })
    },
    markPrepared: async (scopeKey: string) => {
      const request = this.requestRows.get(scopeKey)
      if (request !== undefined) this.requestRows.set(scopeKey, { ...request, localPrepared: true })
    },
    removeByGeneration: async (generationId: string) => {
      for (const [key, request] of this.requestRows) {
        if (request.generationId === generationId) this.requestRows.delete(key)
      }
    },
    list: async () => [...this.requestRows.values()],
  }
}

describe('AI generation actions', () => {
  it('saves an offline script request as locally pending without network work', async () => {
    const harness = new MemoryHarness()
    harness.online = false
    const action = new StartScriptCueGeneration(
      harness.scripts,
      harness.saver,
      harness.connectivity,
      harness.sync,
      harness.gateway,
      harness.requests,
    )

    const result = await action.execute(scriptId)

    expect(result).toEqual({ state: 'waiting-for-network', generation: null })
    expect(harness.events).toEqual(['save'])
    expect(harness.script.cards.map(({ cueSet }) => cueSet.status)).toEqual(['pending', 'stale'])
    expect(harness.script.cards[1]?.cueSet.cues).toEqual([
      'Ручной тезис один',
      'Ручной тезис два',
      'Ручной тезис три',
    ])
    expect(harness.requestRows.get(`script:${scriptId}`)).toMatchObject({
      scriptId,
      cardId: null,
      operationId: expect.any(String),
      localPrepared: true,
      generationId: null,
    })
  })

  it('saves, synchronizes, and then starts an online script generation', async () => {
    const harness = new MemoryHarness()
    const action = new StartScriptCueGeneration(
      harness.scripts,
      harness.saver,
      harness.connectivity,
      harness.sync,
      harness.gateway,
      harness.requests,
    )

    const result = await action.execute(scriptId)

    expect(result).toEqual({ state: 'tracking', generation: queuedGeneration })
    expect(harness.events).toEqual(['save', 'sync', 'start-script'])
    expect(harness.requestRows.get(`script:${scriptId}`)?.generationId).toBe(queuedGeneration.id)
  })

  it('starts only the selected card and preserves its full text', async () => {
    const harness = new MemoryHarness()
    const fullText = harness.script.cards[0]?.fullText
    const action = new StartCardCueGeneration(
      harness.scripts,
      harness.saver,
      harness.connectivity,
      harness.sync,
      harness.gateway,
      harness.requests,
    )

    const result = await action.execute({ scriptId, cardId: firstCardId })

    expect(result.state).toBe('tracking')
    expect(harness.events).toEqual(['save', 'sync', `start-card:${firstCardId}:false`])
    expect(harness.script.cards[0]?.cueSet.status).toBe('pending')
    expect(harness.script.cards[1]?.cueSet.status).toBe('stale')
    expect(harness.script.cards[0]?.fullText).toBe(fullText)
  })

  it.each([
    ['retrying', 'waiting-for-network'],
    ['auth-required', 'auth-required'],
    ['conflict', 'conflict'],
  ] as const)('does not start server generation while sync is %s', async (syncState, expectedState) => {
    const harness = new MemoryHarness()
    harness.syncState = syncState
    const action = new StartScriptCueGeneration(
      harness.scripts,
      harness.saver,
      harness.connectivity,
      harness.sync,
      harness.gateway,
      harness.requests,
    )

    const result = await action.execute(scriptId)

    expect(result).toEqual({ state: expectedState, generation: null })
    expect(harness.events).toEqual(['save', 'sync'])
  })

  it('keeps the locally saved script usable when authentication fails', async () => {
    const harness = new MemoryHarness()
    harness.startError = new ApiError(
      401,
      'AUTH_UNAUTHENTICATED',
      'Требуется вход.',
      '019b9ccb-3f71-7000-8000-000000000521',
    )
    const fullText = harness.script.cards.map(({ fullText }) => fullText)
    const action = new StartScriptCueGeneration(
      harness.scripts,
      harness.saver,
      harness.connectivity,
      harness.sync,
      harness.gateway,
      harness.requests,
    )

    await expect(action.execute(scriptId)).rejects.toMatchObject({ status: 401 })

    expect(harness.script.cards.map(({ fullText: value }) => value)).toEqual(fullText)
    expect(harness.script.cards[0]?.cueSet.status).toBe('pending')
  })

  it('requires an explicit replacement flag before regenerating manual cues', async () => {
    const harness = new MemoryHarness()
    const action = new StartCardCueGeneration(
      harness.scripts,
      harness.saver,
      harness.connectivity,
      harness.sync,
      harness.gateway,
      harness.requests,
    )

    await expect(action.execute({ scriptId, cardId: secondCardId }))
      .rejects.toThrow('Manual cues require explicit replacement')
    expect(harness.events).toEqual([])

    await action.execute({ scriptId, cardId: secondCardId, replaceManual: true })

    expect(harness.script.cards[1]?.cueSet).toMatchObject({
      cues: ['Ручной тезис один', 'Ручной тезис два', 'Ручной тезис три'],
      manuallyEdited: true,
      status: 'pending',
    })
  })

  it('refreshes a terminal generation through ordinary sync without applying cues itself', async () => {
    const harness = new MemoryHarness()
    harness.generation = {
      ...queuedGeneration,
      status: 'completed',
      completedCards: 2,
      updatedAt: '2026-08-07T12:01:00.000Z',
    }
    const originalStaleCues = harness.script.cards[1]?.cueSet.cues
    await harness.requests.upsertPending({
      scopeKey: `script:${scriptId}`,
      scriptId,
      cardId: null,
      operationId: '019b9ccb-3f71-7000-8000-000000000534',
      localPrepared: true,
      replaceManual: false,
      generationId: null,
      createdAt: '2026-08-07T12:00:00.000Z',
    })
    await harness.requests.markStarted(`script:${scriptId}`, queuedGeneration.id)
    const refresh = new RefreshGeneration(harness.gateway, harness.sync, harness.requests)

    const generation = await refresh.execute(queuedGeneration.id)

    expect(generation.status).toBe('completed')
    expect(harness.events).toEqual(['sync'])
    expect(harness.script.cards[1]?.cueSet.status).toBe('stale')
    expect(harness.script.cards[1]?.cueSet.cues).toBe(originalStaleCues)
    expect(harness.requestRows.size).toBe(0)
  })

  it('restarts a durable pending request after an application restart', async () => {
    const harness = new MemoryHarness()
    harness.requestRows.set(`card:${firstCardId}`, {
      scopeKey: `card:${firstCardId}`,
      scriptId,
      cardId: firstCardId,
      operationId: '019b9ccb-3f71-7000-8000-000000000531',
      localPrepared: true,
      replaceManual: false,
      generationId: null,
      createdAt: '2026-08-07T12:00:00.000Z',
    })
    const startScript = new StartScriptCueGeneration(
      harness.scripts,
      harness.saver,
      harness.connectivity,
      harness.sync,
      harness.gateway,
      harness.requests,
    )
    const startCard = new StartCardCueGeneration(
      harness.scripts,
      harness.saver,
      harness.connectivity,
      harness.sync,
      harness.gateway,
      harness.requests,
    )
    const tracked: string[] = []
    const resume = new ResumeAiGenerations(
      harness.requests,
      startScript,
      startCard,
      { track: (generationId) => {
        tracked.push(generationId)
        return () => undefined
      } },
    )

    await resume.execute()

    expect(harness.events).toEqual([
      'sync',
      `start-card:${firstCardId}:false`,
    ])
    expect(harness.requestRows.get(`card:${firstCardId}`)?.generationId)
      .toBe(queuedGeneration.id)
    expect(harness.startedOperations).toEqual([
      '019b9ccb-3f71-7000-8000-000000000531',
    ])
    expect(tracked).toEqual([queuedGeneration.id])
  })

  it('reattaches polling for a durable request that already has a generation id', async () => {
    const harness = new MemoryHarness()
    harness.requestRows.set(`script:${scriptId}`, {
      scopeKey: `script:${scriptId}`,
      scriptId,
      cardId: null,
      operationId: '019b9ccb-3f71-7000-8000-000000000532',
      localPrepared: true,
      replaceManual: false,
      generationId: queuedGeneration.id,
      createdAt: '2026-08-07T12:00:00.000Z',
    })
    const tracked: string[] = []
    const resume = new ResumeAiGenerations(
      harness.requests,
      { execute: async () => ({ state: 'tracking', generation: queuedGeneration }) },
      { execute: async () => ({ state: 'tracking', generation: queuedGeneration }) },
      { track: (generationId) => {
        tracked.push(generationId)
        return () => undefined
      } },
    )

    await resume.execute()
    await resume.execute()

    expect(tracked).toEqual([queuedGeneration.id])
  })

  it('keeps one resume listener after transient errors but reattaches after auth stops polling', async () => {
    const harness = new MemoryHarness()
    harness.requestRows.set(`script:${scriptId}`, {
      scopeKey: `script:${scriptId}`,
      scriptId,
      cardId: null,
      operationId: '019b9ccb-3f71-7000-8000-000000000533',
      localPrepared: true,
      replaceManual: false,
      generationId: queuedGeneration.id,
      createdAt: '2026-08-07T12:00:00.000Z',
    })
    let reportError: ((error: unknown) => void) | null = null
    let trackCalls = 0
    const resume = new ResumeAiGenerations(
      harness.requests,
      { execute: async () => ({ state: 'tracking', generation: queuedGeneration }) },
      { execute: async () => ({ state: 'tracking', generation: queuedGeneration }) },
      { track: (_generationId, _listener, onError) => {
        trackCalls += 1
        reportError = onError
        return () => undefined
      } },
    )

    await resume.execute()
    ;(reportError as ((error: unknown) => void) | null)?.(new Error('temporary'))
    await resume.execute()
    expect(trackCalls).toBe(1)

    ;(reportError as ((error: unknown) => void) | null)?.(
      new ApiError(401, 'AUTH_UNAUTHENTICATED', 'expired', 'correlation-id'),
    )
    await resume.execute()
    expect(trackCalls).toBe(2)
  })

  it('uses one cancellable poll chain per generation with 2/5/10-second intervals', async () => {
    const harness = new MemoryHarness()
    let reads = 0
    harness.gateway.get = async () => {
      reads += 1
      return { ...queuedGeneration, status: 'running' }
    }
    const scheduled: Array<{ readonly work: () => void; readonly delay: number; cancelled: boolean }> = []
    const updates: string[] = []
    const refresh = new RefreshGeneration(
      harness.gateway,
      harness.sync,
      harness.requests,
      (work, delay) => {
        const entry = { work, delay, cancelled: false }
        scheduled.push(entry)
        return entry
      },
      (handle) => { handle.cancelled = true },
    )

    const cancelFirst = refresh.track(queuedGeneration.id, (generation) => {
      updates.push(`first:${generation.status}`)
    })
    const cancelSecond = refresh.track(queuedGeneration.id, (generation) => {
      updates.push(`second:${generation.status}`)
    })

    expect(scheduled.map(({ delay }) => delay)).toEqual([2_000])
    scheduled[0]?.work()
    await Promise.resolve()
    await Promise.resolve()

    expect(reads).toBe(1)
    expect(updates).toEqual(['first:running', 'second:running'])
    expect(scheduled.map(({ delay }) => delay)).toEqual([2_000, 5_000])

    cancelFirst()
    expect(scheduled[1]?.cancelled).toBe(false)
    cancelSecond()
    expect(scheduled[1]?.cancelled).toBe(true)
  })

  it('stops polling and synchronizes when a tracked generation completes', async () => {
    const harness = new MemoryHarness()
    harness.generation = { ...queuedGeneration, status: 'completed', completedCards: 2 }
    const scheduled: Array<{ readonly work: () => void; readonly delay: number }> = []
    const refresh = new RefreshGeneration(
      harness.gateway,
      harness.sync,
      harness.requests,
      (work, delay) => {
        const entry = { work, delay }
        scheduled.push(entry)
        return entry
      },
      () => undefined,
    )
    const updates: string[] = []

    refresh.track(queuedGeneration.id, ({ status }) => { updates.push(status) })
    scheduled[0]?.work()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(updates).toEqual(['completed'])
    expect(harness.events).toEqual(['sync'])
    expect(scheduled.map(({ delay }) => delay)).toEqual([2_000])
  })

  it('stops automatic polling after an authentication failure', async () => {
    const harness = new MemoryHarness()
    harness.gateway.get = async () => {
      throw new ApiError(401, 'AUTH_UNAUTHENTICATED', 'expired', 'correlation-id')
    }
    const scheduled: Array<{ readonly work: () => void; readonly delay: number }> = []
    const errors: unknown[] = []
    const refresh = new RefreshGeneration(
      harness.gateway,
      harness.sync,
      harness.requests,
      (work, delay) => {
        const entry = { work, delay }
        scheduled.push(entry)
        return entry
      },
      () => undefined,
    )

    refresh.track(queuedGeneration.id, () => undefined, (error) => { errors.push(error) })
    scheduled[0]?.work()
    await Promise.resolve()
    await Promise.resolve()

    expect(errors).toHaveLength(1)
    expect(scheduled.map(({ delay }) => delay)).toEqual([2_000])
  })
})
