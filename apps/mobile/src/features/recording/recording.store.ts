import { defineStore } from 'pinia'

import type { RecordingMode, RecordingSession } from '@/application/ports/RecordingSessionRepository'
import type { ScriptAggregate, ScriptCard } from '@/domain/scripts/types'
import type { RecordingDependencies } from '@/features/recording/recording.dependencies'

export type RecordingLoadState = 'idle' | 'loading' | 'ready' | 'failed'

const mutationQueues = new WeakMap<object, Promise<void>>()

type CueChoice = 'automatic' | 'explicit' | 'unavailable'

function cueChoice(card: ScriptCard | undefined): CueChoice {
  if (card === undefined || card.cueSet.cues.length === 0) return 'unavailable'
  if (card.cueSet.manuallyEdited || card.cueSet.status === 'stale') return 'explicit'
  return card.cueSet.status === 'ready' ? 'automatic' : 'unavailable'
}

async function serializeMutation(owner: object, work: () => Promise<void>): Promise<void> {
  const previous = mutationQueues.get(owner) ?? Promise.resolve()
  const current = previous.then(work)
  mutationQueues.set(owner, current.catch(() => undefined))
  await current
}

export const useRecordingStore = defineStore('recording', {
  state: () => ({
    status: 'idle' as RecordingLoadState,
    script: null as ScriptAggregate | null,
    session: null as RecordingSession | null,
    error: null as string | null,
    warning: null as string | null,
    routeActive: false,
    appActive: true,
    wakeLockHeld: false,
    scrollPositions: {} as Record<string, number>,
    cueOverrides: {} as Record<string, boolean>,
  }),
  getters: {
    activeCards(state) {
      return (state.script?.cards ?? [])
        .filter(({ deletedAt }) => deletedAt === null)
        .sort((left, right) => left.position - right.position)
    },
    canChooseCues(state): boolean {
      const card = state.script?.cards.find(({ id }) => id === state.session?.currentCardId)
      return cueChoice(card) !== 'unavailable'
    },
    effectiveMode(state): RecordingMode {
      if (state.session === null || state.session.mode === 'full') return 'full'
      const card = state.script?.cards.find(({ id }) => id === state.session?.currentCardId)
      const choice = cueChoice(card)
      if (choice === 'automatic') return 'cues'
      if (choice === 'explicit' && card !== undefined && state.cueOverrides[card.id] === true) {
        return 'cues'
      }
      return 'full'
    },
  },
  actions: {
    enterRoute(): void {
      this.routeActive = true
    },
    async load(scriptId: string, dependencies: RecordingDependencies): Promise<void> {
      this.status = 'loading'
      this.error = null
      await serializeMutation(this, async () => {
        try {
          this.script = await dependencies.loadScript.execute(scriptId)
          const saved = await dependencies.loadSession(scriptId)
          const savedCardExists = saved !== null
            && this.activeCards.some(({ id }) => id === saved.currentCardId)
          this.session = savedCardExists ? saved : null
          const savedCard = this.activeCards.find(({ id }) => id === this.session?.currentCardId)
          if (this.session?.mode === 'cues' && cueChoice(savedCard) === 'explicit') {
            this.cueOverrides[this.session.currentCardId] = true
          }
          if (this.session !== null && this.routeActive && this.appActive) {
            await dependencies.wakeLock.acquire()
            this.wakeLockHeld = true
            this.captureWakeLockWarning(dependencies)
          }
          this.status = 'ready'
        } catch {
          this.status = 'failed'
          this.error = 'Не удалось открыть локальную сессию записи.'
        }
      })
    },
    async start(
      input: { cardId: string; mode: RecordingMode; fontScale: number },
      dependencies: RecordingDependencies,
    ): Promise<void> {
      if (this.script === null) return
      await serializeMutation(this, async () => {
        if (this.script === null) return
        try {
          this.session = await dependencies.startRecording.execute({
            scriptId: this.script.id,
            ...input,
          })
          const selectedCard = this.activeCards.find(({ id }) => id === input.cardId)
          if (input.mode === 'cues' && cueChoice(selectedCard) === 'explicit') {
            this.cueOverrides[input.cardId] = true
          }
          this.wakeLockHeld = true
          this.captureWakeLockWarning(dependencies)
        } catch {
          this.error = 'Не удалось начать запись. Проверьте локальные данные.'
        }
      })
    },
    async move(
      direction: 'previous' | 'next',
      dependencies: RecordingDependencies,
    ): Promise<void> {
      if (this.session === null) return
      await serializeMutation(this, async () => {
        if (this.session === null) return
        try {
          this.session = await dependencies.moveRecordingCursor.execute({
            sessionId: this.session.scriptId,
            direction,
          })
        } catch {
          this.wakeLockHeld = false
          this.error = 'Не удалось сохранить позицию записи.'
        } finally {
          this.captureWakeLockWarning(dependencies)
        }
      })
    },
    async updateDisplay(
      input: { mode: RecordingMode; fontScale: number },
      dependencies: RecordingDependencies,
    ): Promise<void> {
      if (this.session === null) return
      await serializeMutation(this, () => this.persistDisplay(input, dependencies))
    },
    async toggleMode(dependencies: RecordingDependencies): Promise<void> {
      if (this.session === null) return
      await serializeMutation(this, async () => {
        if (this.session === null) return
        const card = this.activeCards.find(({ id }) => id === this.session?.currentCardId)
        const choice = cueChoice(card)
        if (choice === 'unavailable') return
        const showingCues = this.session.mode === 'cues'
          && (choice === 'automatic' || (card !== undefined && this.cueOverrides[card.id] === true))
        if (!showingCues && choice === 'explicit' && card !== undefined) {
          this.cueOverrides[card.id] = true
          if (this.session.mode === 'cues') return
        }
        await this.persistDisplay({
          mode: showingCues ? 'full' : 'cues',
          fontScale: this.session.fontScale,
        }, dependencies)
      })
    },
    async finish(dependencies: RecordingDependencies): Promise<void> {
      if (this.session === null) return
      await serializeMutation(this, async () => {
        if (this.session === null) return
        const sessionId = this.session.scriptId
        try {
          await dependencies.finishRecording.execute(sessionId)
          this.wakeLockHeld = false
          this.session = null
          await dependencies.openLibrary()
        } catch {
          this.error = 'Не удалось завершить локальную сессию.'
        }
      })
    },
    async setAppActive(isActive: boolean, dependencies: RecordingDependencies): Promise<void> {
      this.appActive = isActive
      await serializeMutation(this, async () => {
        if (this.session === null) return
        if (this.appActive && this.routeActive && !this.wakeLockHeld) {
          await dependencies.wakeLock.acquire()
          this.wakeLockHeld = true
        } else if (!this.appActive && this.wakeLockHeld) {
          await dependencies.wakeLock.release()
          this.wakeLockHeld = false
        }
        this.captureWakeLockWarning(dependencies)
      })
    },
    async leaveRoute(dependencies: RecordingDependencies): Promise<void> {
      this.routeActive = false
      await serializeMutation(this, async () => {
        if (!this.wakeLockHeld) return
        await dependencies.wakeLock.release()
        this.wakeLockHeld = false
        this.captureWakeLockWarning(dependencies)
      })
    },
    rememberScroll(cardId: string, scrollTop: number): void {
      this.scrollPositions[cardId] = scrollTop
    },
    captureWakeLockWarning(dependencies: RecordingDependencies): void {
      const warning = dependencies.wakeLock.takeWarning()
      if (warning !== null) this.warning = warning
    },
    async persistDisplay(
      input: { mode: RecordingMode; fontScale: number },
      dependencies: RecordingDependencies,
    ): Promise<void> {
      if (this.session === null) return
      try {
        this.session = await dependencies.updateRecordingDisplay.execute({
          sessionId: this.session.scriptId,
          ...input,
        })
      } catch {
        this.error = 'Не удалось сохранить настройки записи.'
      }
    },
  },
})
