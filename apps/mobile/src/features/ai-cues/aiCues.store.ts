import { defineStore } from 'pinia'

import type { StartGenerationResult } from '@/application/ai/StartScriptCueGeneration'
import type { AiGeneration } from '@/application/ports/AiGenerationGateway'
import { ApiError } from '@/application/ports/ApiClient'
import type { AiCuesDependencies } from '@/features/ai-cues/aiCues.dependencies'

interface GenerationScope {
  readonly generation: AiGeneration | null
  readonly waiting: boolean
  readonly busy: boolean
  readonly error: string | null
}

const trackers = new WeakMap<object, Map<string, () => void>>()

function emptyScope(): GenerationScope {
  return { generation: null, waiting: false, busy: false, error: null }
}

function scriptKey(scriptId: string): string {
  return `script:${scriptId}`
}

function cardKey(cardId: string): string {
  return `card:${cardId}`
}

function activeGeneration(scope: GenerationScope | undefined): boolean {
  return scope?.generation?.status === 'queued' || scope?.generation?.status === 'running'
}

function publicError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Войдите снова, чтобы создавать тезисы. Полный текст доступен офлайн.'
  }
  return 'Не удалось обновить тезисы. Полный текст и прежние тезисы сохранены.'
}

export const useAiCuesStore = defineStore('ai-cues', {
  state: () => ({
    scopes: {} as Record<string, GenerationScope | undefined>,
  }),
  getters: {
    forScript: (state) => (scriptId: string): AiGeneration | null => (
      state.scopes[scriptKey(scriptId)]?.generation ?? null
    ),
    forCard: (state) => (cardId: string): AiGeneration | null => (
      state.scopes[cardKey(cardId)]?.generation ?? null
    ),
    waitingForNetwork: (state) => (scriptId: string): boolean => (
      state.scopes[scriptKey(scriptId)]?.waiting ?? false
    ),
    cardWaitingForNetwork: (state) => (cardId: string): boolean => (
      state.scopes[cardKey(cardId)]?.waiting ?? false
    ),
    errorForScript: (state) => (scriptId: string): string | null => (
      state.scopes[scriptKey(scriptId)]?.error ?? null
    ),
    errorForCard: (state) => (cardId: string): string | null => (
      state.scopes[cardKey(cardId)]?.error ?? null
    ),
    busyForScript: (state) => (scriptId: string): boolean => {
      const direct = state.scopes[scriptKey(scriptId)]
      return (direct?.busy ?? false) || activeGeneration(direct)
        || Object.values(state.scopes).some((scope) => (
          scope?.generation?.scriptId === scriptId && activeGeneration(scope)
        ))
    },
    busyForCard: (state) => (cardId: string): boolean => (
      (state.scopes[cardKey(cardId)]?.busy ?? false)
        || activeGeneration(state.scopes[cardKey(cardId)])
    ),
  },
  actions: {
    async startScript(scriptId: string, dependencies: AiCuesDependencies): Promise<void> {
      if (this.busyForScript(scriptId)) return
      const key = scriptKey(scriptId)
      await this.start(key, () => dependencies.startScript.execute(scriptId), dependencies)
    },
    async startCard(
      scriptId: string,
      cardId: string,
      dependencies: AiCuesDependencies,
      replaceManual = false,
    ): Promise<void> {
      if (this.busyForScript(scriptId) || this.busyForCard(cardId)) return
      const key = cardKey(cardId)
      await this.start(
        key,
        () => dependencies.startCard.execute({ scriptId, cardId, replaceManual }),
        dependencies,
      )
    },
    async refreshScript(scriptId: string, dependencies: AiCuesDependencies): Promise<void> {
      await this.refresh(scriptKey(scriptId), dependencies)
    },
    async refreshCard(cardId: string, dependencies: AiCuesDependencies): Promise<void> {
      await this.refresh(cardKey(cardId), dependencies)
    },
    disposeScript(scriptId: string): void {
      this.dispose(scriptKey(scriptId))
    },
    disposeCard(cardId: string): void {
      this.dispose(cardKey(cardId))
    },
    async start(
      key: string,
      work: () => Promise<StartGenerationResult>,
      dependencies: AiCuesDependencies,
    ): Promise<void> {
      const current = this.scopes[key] ?? emptyScope()
      if (current.busy) return
      this.scopes[key] = { ...current, busy: true, error: null }
      try {
        const result = await work()
        this.acceptStart(key, result, dependencies)
      } catch (error: unknown) {
        this.scopes[key] = {
          ...(this.scopes[key] ?? emptyScope()),
          busy: false,
          error: publicError(error),
        }
      }
    },
    acceptStart(
      key: string,
      result: StartGenerationResult,
      dependencies: AiCuesDependencies,
    ): void {
      this.dispose(key)
      if (result.state === 'waiting-for-network') {
        this.scopes[key] = { generation: null, waiting: true, busy: false, error: null }
        return
      }
      if (result.state === 'auth-required') {
        this.scopes[key] = {
          generation: null,
          waiting: false,
          busy: false,
          error: 'Войдите снова, чтобы создавать тезисы. Полный текст доступен офлайн.',
        }
        return
      }
      if (result.state === 'conflict') {
        this.scopes[key] = {
          generation: null,
          waiting: false,
          busy: false,
          error: 'Сначала разрешите конфликт синхронизации. Локальный полный текст сохранён.',
        }
        return
      }

      this.scopes[key] = {
        generation: result.generation,
        waiting: false,
        busy: false,
        error: null,
      }
      const map = trackers.get(this) ?? new Map<string, () => void>()
      trackers.set(this, map)
      map.set(key, dependencies.refresh.track(
        result.generation.id,
        (generation) => {
          this.scopes[key] = {
            generation,
            waiting: false,
            busy: false,
            error: generation.status === 'failed'
              ? 'Не удалось создать тезисы. Полный текст и прежние тезисы сохранены.'
              : null,
          }
        },
        (error) => {
          this.scopes[key] = {
            ...(this.scopes[key] ?? emptyScope()),
            busy: false,
            error: publicError(error),
          }
        },
      ))
    },
    async refresh(key: string, dependencies: AiCuesDependencies): Promise<void> {
      const generationId = this.scopes[key]?.generation?.id
      if (generationId === undefined) return
      try {
        const generation = await dependencies.refresh.execute(generationId)
        this.scopes[key] = {
          generation,
          waiting: false,
          busy: false,
          error: generation.status === 'failed'
            ? 'Не удалось создать тезисы. Полный текст и прежние тезисы сохранены.'
            : null,
        }
      } catch (error: unknown) {
        this.scopes[key] = {
          ...(this.scopes[key] ?? emptyScope()),
          error: publicError(error),
        }
      }
    },
    acceptResumed(key: string, result: StartGenerationResult): void {
      if (result.state === 'waiting-for-network') {
        this.scopes[key] = { generation: null, waiting: true, busy: false, error: null }
        return
      }
      if (result.state === 'auth-required') {
        this.scopes[key] = {
          generation: null,
          waiting: false,
          busy: false,
          error: 'Войдите снова, чтобы создавать тезисы. Полный текст доступен офлайн.',
        }
        return
      }
      if (result.state === 'conflict') {
        this.scopes[key] = {
          generation: null,
          waiting: false,
          busy: false,
          error: 'Сначала разрешите конфликт синхронизации. Локальный полный текст сохранён.',
        }
        return
      }
      this.updateResumed(key, result.generation)
    },
    updateResumed(key: string, generation: AiGeneration): void {
      this.scopes[key] = {
        generation,
        waiting: false,
        busy: false,
        error: generation.status === 'failed'
          ? 'Не удалось создать тезисы. Полный текст и прежние тезисы сохранены.'
          : null,
      }
    },
    failResumed(key: string, error: unknown): void {
      this.scopes[key] = {
        ...(this.scopes[key] ?? emptyScope()),
        busy: false,
        error: publicError(error),
      }
    },
    dispose(key: string): void {
      const map = trackers.get(this)
      map?.get(key)?.()
      map?.delete(key)
    },
  },
})
