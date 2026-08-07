import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/application/ports/ApiClient'
import type { AiGeneration } from '@/application/ports/AiGenerationGateway'
import { ResumeAiGenerations } from '@/application/ai/ResumeAiGenerations'
import type { AiCuesDependencies } from '@/features/ai-cues/aiCues.dependencies'
import { useAiCuesStore } from '@/features/ai-cues/aiCues.store'

const generation: AiGeneration = {
  id: '019b9ccb-3f71-7000-8000-000000000520',
  scriptId: '019b9ccb-3f71-7000-8000-000000000510',
  cardId: null,
  status: 'queued',
  completedCards: 0,
  totalCards: 2,
  error: null,
  createdAt: '2026-08-07T12:00:00.000Z',
  updatedAt: '2026-08-07T12:00:00.000Z',
}

function harness() {
  let tracked: ((generation: AiGeneration) => void) | null = null
  let cancelled = 0
  const dependencies: AiCuesDependencies = {
    startScript: { execute: async () => ({ state: 'tracking', generation }) },
    startCard: { execute: async ({ cardId }) => ({
      state: 'tracking',
      generation: { ...generation, cardId, totalCards: 1 },
    }) },
    refresh: {
      execute: async () => generation,
      track: (_generationId, listener) => {
        tracked = listener
        return () => { cancelled += 1 }
      },
    },
  }
  return {
    dependencies,
    publish: (value: AiGeneration) => tracked?.(value),
    cancelled: () => cancelled,
  }
}

describe('AI cues store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('tracks server progress and cancels it when the route scope is disposed', async () => {
    const context = harness()
    const store = useAiCuesStore()

    await store.startScript(generation.scriptId, context.dependencies)
    context.publish({ ...generation, status: 'running', completedCards: 1 })

    expect(store.forScript(generation.scriptId)?.status).toBe('running')
    expect(store.waitingForNetwork(generation.scriptId)).toBe(false)

    store.disposeScript(generation.scriptId)
    expect(context.cancelled()).toBe(1)
  })

  it('keeps an offline request visible as waiting for network', async () => {
    const context = harness()
    context.dependencies.startScript.execute = async () => ({
      state: 'waiting-for-network',
      generation: null,
    })
    const store = useAiCuesStore()

    await store.startScript(generation.scriptId, context.dependencies)

    expect(store.forScript(generation.scriptId)).toBeNull()
    expect(store.waitingForNetwork(generation.scriptId)).toBe(true)
  })

  it('surfaces a localized auth error without discarding generation state', async () => {
    const context = harness()
    context.dependencies.startScript.execute = async () => {
      throw new ApiError(401, 'AUTH_UNAUTHENTICATED', 'transport text', 'correlation-id')
    }
    const store = useAiCuesStore()

    await store.startScript(generation.scriptId, context.dependencies)

    expect(store.errorForScript(generation.scriptId)).toBe(
      'Войдите снова, чтобы создавать тезисы. Полный текст доступен офлайн.',
    )
  })

  it('surfaces a safe card-scoped error', async () => {
    const context = harness()
    context.dependencies.startCard.execute = async () => {
      throw new ApiError(409, 'AI_CONFLICT', 'transport text', 'correlation-id')
    }
    const store = useAiCuesStore()

    await store.startCard(generation.scriptId, 'card-a', context.dependencies)

    expect(store.errorForCard('card-a')).toBe(
      'Не удалось обновить тезисы. Полный текст и прежние тезисы сохранены.',
    )
  })

  it('ignores a duplicate start while the same scope is busy', async () => {
    const context = harness()
    let resolveStart: ((value: Awaited<ReturnType<typeof context.dependencies.startScript.execute>>) => void) | null = null
    const execute = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveStart = resolve
    }))
    context.dependencies.startScript.execute = execute
    const store = useAiCuesStore()

    const first = store.startScript(generation.scriptId, context.dependencies)
    const second = store.startScript(generation.scriptId, context.dependencies)

    expect(store.busyForScript(generation.scriptId)).toBe(true)
    expect(execute).toHaveBeenCalledOnce()
    ;(resolveStart as ((value: unknown) => void) | null)?.({ state: 'tracking', generation })
    await Promise.all([first, second])
  })

  it('ignores another paid start while the scope is already queued or running', async () => {
    const context = harness()
    const execute = vi.fn(context.dependencies.startScript.execute)
    context.dependencies.startScript.execute = execute
    const store = useAiCuesStore()

    await store.startScript(generation.scriptId, context.dependencies)
    await store.startScript(generation.scriptId, context.dependencies)

    expect(execute).toHaveBeenCalledOnce()
  })

  it('hydrates an open offline scope from resumed start and polling events', async () => {
    const context = harness()
    context.dependencies.startScript.execute = async () => ({
      state: 'waiting-for-network',
      generation: null,
    })
    const store = useAiCuesStore()
    await store.startScript(generation.scriptId, context.dependencies)
    let publish: ((value: AiGeneration) => void) | null = null
    const request = {
      scopeKey: `script:${generation.scriptId}`,
      scriptId: generation.scriptId,
      cardId: null,
      operationId: '019b9ccb-3f71-7000-8000-000000000530',
      localPrepared: true,
      replaceManual: false,
      generationId: null,
      createdAt: '2026-08-07T12:00:00.000Z',
    }
    const resume = new ResumeAiGenerations(
      {
        upsertPending: async () => undefined,
        markStarted: async () => undefined,
        markPrepared: async () => undefined,
        removeByGeneration: async () => undefined,
        list: async () => [request],
      },
      { execute: async () => ({ state: 'tracking', generation }) },
      { execute: async () => ({ state: 'tracking', generation }) },
      { track: (_generationId, listener) => {
        publish = listener
        return () => undefined
      } },
      {
        accepted: (scopeKey, result) => { store.acceptResumed(scopeKey, result) },
        updated: (scopeKey, value) => { store.updateResumed(scopeKey, value) },
        failed: (scopeKey, error) => { store.failResumed(scopeKey, error) },
      },
    )

    await resume.execute()
    expect(store.waitingForNetwork(generation.scriptId)).toBe(false)
    expect(store.forScript(generation.scriptId)?.status).toBe('queued')

    ;(publish as ((value: AiGeneration) => void) | null)?.({
      ...generation,
      status: 'running',
      completedCards: 1,
    })
    expect(store.forScript(generation.scriptId)?.status).toBe('running')
  })
})
