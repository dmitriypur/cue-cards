import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { RecordingSession } from '@/application/ports/RecordingSessionRepository'
import type { ScriptAggregate, ScriptCard } from '@/domain/scripts/types'
import RecordingView from '@/features/recording/RecordingView.vue'
import { useRecordingStore } from '@/features/recording/recording.store'
import {
  recordingDependenciesKey,
  type RecordingDependencies,
} from '@/features/recording/recording.dependencies'

const now = '2026-08-06T12:00:00.000Z'

function card(id: string, position: number): ScriptCard {
  return {
    id,
    scriptId: 'script-1',
    position,
    title: ['Хук', 'Главная мысль', 'Финал'][position]!,
    fullText: `Полный текст карточки ${position + 1}. `.repeat(12),
    contentHash: `hash-${id}`,
    version: 0,
    cueSet: {
      id: `cue-${id}`,
      cardId: id,
      cues: ['Короткий тезис один', 'Короткий тезис два', 'Короткий тезис три'],
      sourceHash: `hash-${id}`,
      status: 'ready',
      generationId: null,
      manuallyEdited: false,
      version: 0,
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

const script: ScriptAggregate = {
  id: 'script-1',
  title: 'Сценарий для записи',
  sourceFormat: 'markdown',
  sourceText: '# Сценарий',
  importHash: 'import-hash',
  serverVersion: 0,
  syncStatus: 'local',
  cards: [card('card-a', 0), card('card-b', 1), card('card-c', 2)],
  lastOpenedAt: now,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}

function createHarness(
  initialSession: RecordingSession | null = null,
  initialWakeWarning: string | null = null,
  initialScriptGate: Promise<void> | null = null,
  sourceScript: ScriptAggregate = script,
) {
  let session = initialSession
  let appState: ((isActive: boolean) => void | Promise<void>) | null = null
  let releases = 0
  let acquisitions = 0
  let wakeWarning = initialWakeWarning
  let acquireGate: Promise<void> | null = null
  const wakeEvents: string[] = []

  const dependencies: RecordingDependencies = {
    loadScript: { execute: async () => {
      await initialScriptGate
      return sourceScript
    } },
    loadSession: async () => session,
    startRecording: {
      execute: async (input) => {
        session = {
          scriptId: input.scriptId,
          currentCardId: input.cardId,
          mode: input.mode,
          fontScale: input.fontScale,
          updatedAt: now,
        }
        return session
      },
    },
    moveRecordingCursor: {
      execute: async ({ direction }) => {
        if (session === null) throw new Error('missing session')
        const snapshot = session
        await Promise.resolve()
        const index = sourceScript.cards.findIndex(({ id }) => id === snapshot.currentCardId)
        const offset = direction === 'previous' ? -1 : 1
        const next = sourceScript.cards[
          Math.min(Math.max(index + offset, 0), sourceScript.cards.length - 1)
        ]!
        session = { ...snapshot, currentCardId: next.id, updatedAt: now }
        return session
      },
    },
    updateRecordingDisplay: {
      execute: async ({ mode, fontScale }) => {
        if (session === null) throw new Error('missing session')
        const snapshot = session
        await Promise.resolve()
        session = { ...snapshot, mode, fontScale, updatedAt: now }
        return session
      },
    },
    finishRecording: {
      execute: async () => { session = null; releases += 1 },
    },
    wakeLock: {
      acquire: async () => {
        acquisitions += 1
        wakeEvents.push('acquire:start')
        await acquireGate
        wakeEvents.push('acquire:end')
      },
      release: async () => { releases += 1; wakeEvents.push('release') },
      takeWarning: () => {
        const warning = wakeWarning
        wakeWarning = null
        return warning
      },
    },
    onAppStateChange(listener) {
      appState = listener
      return () => { appState = null }
    },
    openLibrary: async () => undefined,
  }

  return {
    dependencies,
    session: () => session,
    appState: () => appState,
    releases: () => releases,
    acquisitions: () => acquisitions,
    wakeEvents: () => wakeEvents,
    setAcquireGate: (gate: Promise<void> | null) => { acquireGate = gate },
  }
}

async function mountRecording(dependencies: RecordingDependencies, settle = true) {
  const wrapper = mount(RecordingView, {
    props: { scriptId: script.id },
    global: { provide: { [recordingDependenciesKey as symbol]: dependencies } },
  })
  if (settle) await flushPromises()
  return wrapper
}

describe('RecordingView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts at any selected card with the chosen display settings', async () => {
    const context = createHarness()
    const wrapper = await mountRecording(context.dependencies)

    expect(wrapper.get('h1').text()).toBe('Настройка записи')
    await wrapper.get('[aria-label="Начальная карточка"]').setValue('card-b')
    await wrapper.get('button[aria-label="Полный текст по умолчанию"]').trigger('click')
    await wrapper.get('[aria-label="Размер текста"]').setValue('1.4')
    await wrapper.get('button[data-start-recording]').trigger('click')
    await flushPromises()

    expect(context.session()).toMatchObject({
      currentCardId: 'card-b',
      mode: 'full',
      fontScale: 1.4,
    })
    expect(wrapper.text()).toContain('Главная мысль')
    expect(wrapper.text()).toContain('Полный текст карточки 2')
  })

  it('restores a session and provides progress, global mode, buttons, and swipe parity', async () => {
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-b',
      mode: 'cues',
      fontScale: 1.25,
      updatedAt: now,
    })
    const wrapper = await mountRecording(context.dependencies)

    expect(context.acquisitions()).toBe(1)
    expect(wrapper.text()).toContain('2 из 3')
    expect(wrapper.text()).toContain('Короткий тезис один')
    expect(wrapper.get('[role="group"][aria-label="Режим отображения"]')).toBeTruthy()
    const previous = wrapper.get('button[aria-label="Предыдущая карточка"]')
    const next = wrapper.get('button[aria-label="Следующая карточка"]')
    expect(wrapper.get('[data-focus-card]').classes()).toContain('overflow-hidden')
    expect(wrapper.get('[data-focus-card]').classes()).toContain('h-[calc(100dvh-13rem)]')
    expect(wrapper.get('[data-recording-content]').classes()).toContain('overflow-y-auto')
    expect(previous.classes()).toContain('min-h-12')
    expect(next.classes()).toContain('min-w-12')

    await wrapper.get('button[aria-label="Показать полный текст"]').trigger('click')
    await flushPromises()
    expect(context.session()?.mode).toBe('full')
    expect(wrapper.text()).toContain('Полный текст карточки 2')

    const focus = wrapper.get('[data-focus-card]')
    await focus.trigger('touchstart', { touches: [{ clientX: 240, clientY: 120 }] })
    await focus.trigger('touchend', { changedTouches: [{ clientX: 120, clientY: 110 }] })
    await flushPromises()
    expect(context.session()?.currentCardId).toBe('card-c')
    expect(wrapper.text()).toContain('3 из 3')
    expect(wrapper.get('button[aria-label="Следующая карточка"]').attributes('disabled')).toBeDefined()
  })

  it('falls back to full text for pending cues and automatically returns when they become ready', async () => {
    const pendingScript: ScriptAggregate = {
      ...script,
      cards: script.cards.map((item) => item.id === 'card-b'
        ? { ...item, cueSet: { ...item.cueSet, cues: [], status: 'pending' } }
        : item),
    }
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-b',
      mode: 'cues',
      fontScale: 1,
      updatedAt: now,
    }, null, null, pendingScript)
    const wrapper = await mountRecording(context.dependencies)

    expect(wrapper.text()).toContain('Полный текст карточки 2')
    expect(context.session()?.mode).toBe('cues')
    expect(wrapper.get('button[aria-label="Показать тезисы"]').attributes('disabled'))
      .toBeDefined()

    const store = useRecordingStore()
    store.script = {
      ...pendingScript,
      cards: pendingScript.cards.map((item) => item.id === 'card-b'
        ? { ...item, cueSet: { ...item.cueSet, cues: ['Готовый тезис'], status: 'ready' } }
        : item),
    }
    await flushPromises()

    expect(wrapper.text()).toContain('Готовый тезис')
    expect(context.session()?.mode).toBe('cues')
  })

  it('allows stale manual cues only after an explicit per-card choice', async () => {
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
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-b',
      mode: 'full',
      fontScale: 1,
      updatedAt: now,
    }, null, null, staleScript)
    const wrapper = await mountRecording(context.dependencies)

    expect(wrapper.text()).toContain('Полный текст карточки 2')
    await wrapper.get('button[aria-label="Показать тезисы"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Короткий тезис один')
    expect(context.session()?.mode).toBe('cues')
  })

  it('keeps independent full-text scroll positions for each card in memory', async () => {
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'full',
      fontScale: 1,
      updatedAt: now,
    })
    const wrapper = await mountRecording(context.dependencies)
    const firstContent = wrapper.get<HTMLElement>('[data-recording-content]')
    firstContent.element.scrollTop = 96
    await firstContent.trigger('scroll')

    await wrapper.get('nav button[aria-label="Показать тезисы"]').trigger('click')
    await flushPromises()
    const cuesContent = wrapper.get<HTMLElement>('[data-recording-content]')
    cuesContent.element.scrollTop = 0
    await cuesContent.trigger('scroll')
    await wrapper.get('nav button[aria-label="Показать полный текст"]').trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLElement>('[data-recording-content]').element.scrollTop).toBe(96)

    await wrapper.get('button[aria-label="Следующая карточка"]').trigger('click')
    await flushPromises()
    await wrapper.get('button[aria-label="Предыдущая карточка"]').trigger('click')
    await flushPromises()

    expect(wrapper.get<HTMLElement>('[data-recording-content]').element.scrollTop).toBe(96)
  })

  it('serializes rapid cursor moves and mode toggles without losing an update', async () => {
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'cues',
      fontScale: 1,
      updatedAt: now,
    })
    const wrapper = await mountRecording(context.dependencies)

    const next = wrapper.get('button[aria-label="Следующая карточка"]')
    await Promise.all([next.trigger('click'), next.trigger('click')])
    await flushPromises()
    expect(context.session()?.currentCardId).toBe('card-c')

    const toggle = wrapper.get('nav button[aria-label="Показать полный текст"]')
    await Promise.all([toggle.trigger('click'), toggle.trigger('click')])
    await flushPromises()
    expect(context.session()?.mode).toBe('cues')
  })

  it('releases on background, reacquires on resume, and releases on cleanup', async () => {
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'cues',
      fontScale: 1,
      updatedAt: now,
    })
    const wrapper = await mountRecording(context.dependencies)

    await context.appState()?.(false)
    expect(context.releases()).toBe(1)
    await context.appState()?.(true)
    expect(context.acquisitions()).toBe(2)
    wrapper.unmount()
    await flushPromises()
    expect(context.releases()).toBe(2)
  })

  it('shows a wake-lock failure as a non-blocking recording warning', async () => {
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'cues',
      fontScale: 1,
      updatedAt: now,
    }, 'Экран может выключиться автоматически.')

    const wrapper = await mountRecording(context.dependencies)

    expect(wrapper.get('[data-wake-lock-warning]').text())
      .toContain('Экран может выключиться автоматически.')
    expect(wrapper.text()).toContain('Короткий тезис один')
  })

  it('queues route cleanup after an in-flight resume acquisition', async () => {
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'cues',
      fontScale: 1,
      updatedAt: now,
    })
    const wrapper = await mountRecording(context.dependencies)
    let resolveAcquire: (() => void) | null = null
    context.setAcquireGate(new Promise<void>((resolve) => { resolveAcquire = resolve }))

    const resume = context.appState()?.(true)
    wrapper.unmount()
    ;(resolveAcquire as (() => void) | null)?.()
    await resume
    await flushPromises()

    expect(context.wakeEvents().slice(-2)).toEqual(['acquire:end', 'release'])
  })

  it('does not acquire the wake lock when local loading finishes after unmount', async () => {
    let resolveScript: (() => void) | null = null
    const scriptGate = new Promise<void>((resolve) => { resolveScript = resolve })
    const context = createHarness({
      scriptId: script.id,
      currentCardId: 'card-a',
      mode: 'cues',
      fontScale: 1,
      updatedAt: now,
    }, null, scriptGate)
    const wrapper = await mountRecording(context.dependencies, false)

    wrapper.unmount()
    ;(resolveScript as (() => void) | null)?.()
    await flushPromises()

    expect(context.acquisitions()).toBe(0)
  })
})
