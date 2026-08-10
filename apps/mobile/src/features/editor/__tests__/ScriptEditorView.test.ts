import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScriptAggregate } from '@/domain/scripts/types'
import type { AiGeneration } from '@/application/ports/AiGenerationGateway'
import { aiCuesDependenciesKey } from '@/features/ai-cues/aiCues.dependencies'
import {
  editorDependenciesKey,
  type EditorDependencies,
} from '@/features/editor/editor.dependencies'
import ScriptEditorView from '@/features/editor/ScriptEditorView.vue'

const aggregate: ScriptAggregate = {
  id: 'script-1',
  title: 'Сценарий для редактора',
  sourceFormat: 'markdown',
  sourceText: '# Сценарий для редактора',
  importHash: 'import-hash',
  serverVersion: 2,
  syncStatus: 'synced',
  cards: [
    {
      id: 'card-a',
      scriptId: 'script-1',
      position: 0,
      title: 'Первый блок',
      fullText: 'Первый полный текст.',
      contentHash: 'hash-a',
      version: 1,
      cueSet: {
        id: 'cue-a',
        cardId: 'card-a',
        cues: ['Первый тезис', 'Второй тезис', 'Третий тезис'],
        sourceHash: 'hash-a',
        status: 'ready',
        generationId: 'generation-a',
        manuallyEdited: false,
        version: 1,
        createdAt: '2026-08-06T08:00:00.000Z',
        updatedAt: '2026-08-06T08:00:00.000Z',
      },
      createdAt: '2026-08-06T08:00:00.000Z',
      updatedAt: '2026-08-06T08:00:00.000Z',
      deletedAt: null,
    },
    {
      id: 'card-b',
      scriptId: 'script-1',
      position: 1,
      title: 'Второй блок',
      fullText: 'Второй полный текст.',
      contentHash: 'hash-b',
      version: 1,
      cueSet: {
        id: 'cue-b',
        cardId: 'card-b',
        cues: ['Старый тезис 1', 'Старый тезис 2', 'Старый тезис 3'],
        sourceHash: 'old-hash',
        status: 'stale',
        generationId: 'generation-b',
        manuallyEdited: true,
        version: 1,
        createdAt: '2026-08-06T08:00:00.000Z',
        updatedAt: '2026-08-06T08:00:00.000Z',
      },
      createdAt: '2026-08-06T08:00:00.000Z',
      updatedAt: '2026-08-06T08:00:00.000Z',
      deletedAt: null,
    },
  ],
  lastOpenedAt: '2026-08-06T09:00:00.000Z',
  createdAt: '2026-08-06T08:00:00.000Z',
  updatedAt: '2026-08-06T09:00:00.000Z',
  deletedAt: null,
}

function updatedCard(input: {
  readonly cardId: string
  readonly title: string
  readonly fullText: string
}): ScriptAggregate {
  return {
    ...aggregate,
    syncStatus: 'pending',
    cards: aggregate.cards.map((card) => card.id === input.cardId
      ? { ...card, title: input.title.trim(), fullText: input.fullText }
      : card),
  }
}

function mountEditor() {
  const getScript = vi.fn().mockResolvedValue(aggregate)
  const readScript = vi.fn().mockResolvedValue(aggregate)
  const updateCard = vi.fn().mockImplementation(async (input) => updatedCard(input))
  const reorderCards = vi.fn().mockImplementation(async ({ orderedCardIds }) => ({
    ...aggregate,
    syncStatus: 'pending',
    cards: orderedCardIds.map((id: string, position: number) => ({
      ...aggregate.cards.find((card) => card.id === id)!,
      position,
    })),
  }))
  const splitCard = vi.fn().mockResolvedValue(aggregate)
  const mergeCards = vi.fn().mockResolvedValue({ ...aggregate, cards: [aggregate.cards[0]!] })
  const updateCues = vi.fn().mockImplementation(async ({ cardId, cues }) => ({
    ...aggregate,
    syncStatus: 'pending',
    cards: aggregate.cards.map((card) => card.id === cardId
      ? { ...card, cueSet: { ...card.cueSet, cues, manuallyEdited: true } }
      : card),
  }))
  const generation: AiGeneration = {
    id: 'generation-new',
    scriptId: aggregate.id,
    cardId: null,
    status: 'queued',
    completedCards: 0,
    totalCards: aggregate.cards.length,
    error: null,
    createdAt: '2026-08-07T12:00:00.000Z',
    updatedAt: '2026-08-07T12:00:00.000Z',
  }
  const startScriptGeneration = vi.fn().mockResolvedValue({
    state: 'tracking',
    generation,
  })
  const startCardGeneration = vi.fn().mockImplementation(async ({ cardId }) => ({
    state: 'tracking',
    generation: { ...generation, cardId, totalCards: 1 },
  }))
  let generationListener: ((generation: AiGeneration) => void) | null = null
  let backgroundListener: (() => void) | null = null
  const dependencies: EditorDependencies = {
    getScript: { execute: getScript },
    readScript: { execute: readScript },
    updateCard: { execute: updateCard },
    reorderCards: { execute: reorderCards },
    splitCard: { execute: splitCard },
    mergeCards: { execute: mergeCards },
    updateCues: { execute: updateCues },
    onAppBackground(listener) {
      backgroundListener = listener
      return () => { backgroundListener = null }
    },
  }

  const wrapper = mount(ScriptEditorView, {
    props: { scriptId: aggregate.id },
    global: {
      plugins: [createPinia()],
      provide: {
        [editorDependenciesKey as symbol]: dependencies,
        [aiCuesDependenciesKey as symbol]: {
          startScript: { execute: startScriptGeneration },
          startCard: { execute: startCardGeneration },
          refresh: {
            execute: vi.fn().mockResolvedValue(generation),
            track: vi.fn().mockImplementation((_generationId, listener) => {
              generationListener = listener
              return () => { generationListener = null }
            }),
          },
        },
      },
    },
  })

  return {
    wrapper,
    updateCard,
    reorderCards,
    splitCard,
    mergeCards,
    updateCues,
    startScriptGeneration,
    startCardGeneration,
    generation,
    getScript,
    readScript,
    publishGeneration: (value: AiGeneration) => generationListener?.(value),
    background: () => backgroundListener?.(),
  }
}

describe('ScriptEditorView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders card count, cue statuses, semantic surfaces, and accessible controls', async () => {
    const { wrapper } = mountEditor()
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Сценарий для редактора')
    expect(wrapper.text()).toContain('2 карточки')
    expect(wrapper.text()).toContain('Тезисы готовы')
    expect(wrapper.text()).toContain('Тезисы устарели')
    expect(wrapper.findAll('[data-card-id]')).toHaveLength(2)
    expect(wrapper.get('[data-card-id="card-a"]').classes()).toContain('text-surface-foreground')
    expect(wrapper.get('[data-card-id="card-a"]').classes()).not.toContain('text-white')
    expect(wrapper.get('[data-card-id="card-a"] [data-drag-handle]').attributes('aria-label'))
      .toContain('Перетащить карточку')
    expect(wrapper.get('[data-action="move-down"]').classes()).toContain('min-h-12')
    expect(wrapper.get('[data-action="merge"]').attributes('aria-label')).toContain('Объединить')
  })

  it('debounces card fields, reorders cards, and saves trimmed manual cues', async () => {
    const { wrapper, updateCard, reorderCards, updateCues } = mountEditor()
    await flushPromises()

    const first = wrapper.get('[data-card-id="card-a"]')
    await first.get('[data-field="title"]').setValue('Обновлённый блок')
    await first.get('[data-field="full-text"]').setValue('Обновлённый полный текст.')
    expect(updateCard).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(updateCard).toHaveBeenCalledWith({
      scriptId: aggregate.id,
      cardId: 'card-a',
      title: 'Обновлённый блок',
      fullText: 'Обновлённый полный текст.',
    })
    expect(wrapper.text()).toContain('Сохранено локально')

    await wrapper.get('[data-card-id="card-a"] [data-action="move-down"]').trigger('click')
    await flushPromises()
    expect(reorderCards).toHaveBeenCalledWith({
      scriptId: aggregate.id,
      orderedCardIds: ['card-b', 'card-a'],
    })

    const cueInputs = wrapper.findAll('[data-card-id="card-a"] [data-cue-input]')
    await cueInputs[0]!.setValue('  Новый первый  ')
    await wrapper.get('[data-card-id="card-a"] [data-action="save-cues"]').trigger('click')
    await flushPromises()
    expect(updateCues).toHaveBeenCalledWith({
      scriptId: aggregate.id,
      cardId: 'card-a',
      cues: ['  Новый первый  ', 'Второй тезис', 'Третий тезис'],
    })
  })

  it('flushes pending text on background and confirms merge after opening split controls', async () => {
    const { wrapper, updateCard, splitCard, mergeCards, background } = mountEditor()
    await flushPromises()

    const first = wrapper.get('[data-card-id="card-a"]')
    await first.get('[data-field="full-text"]').setValue('Текст перед уходом в фон.')
    background()
    await flushPromises()
    expect(updateCard).toHaveBeenCalledOnce()

    await first.get('[data-action="split"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Разделить карточку')
    await wrapper.get('[role="dialog"] [data-field="next-title"]').setValue('Продолжение')
    await wrapper.get('[role="dialog"] [data-action="confirm-split"]').trigger('click')
    await flushPromises()
    expect(splitCard).toHaveBeenCalledWith(expect.objectContaining({
      scriptId: aggregate.id,
      cardId: 'card-a',
      nextTitle: 'Продолжение',
    }))

    await wrapper.get('[data-card-id="card-a"] [data-action="merge"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Объединить карточки')
    expect(mergeCards).not.toHaveBeenCalled()
    await wrapper.get('[role="dialog"] [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(mergeCards).toHaveBeenCalledWith({ scriptId: aggregate.id, cardId: 'card-a' })
  })

  it('flushes multiple pending card snapshots sequentially to avoid lost updates', async () => {
    const { wrapper, updateCard, background } = mountEditor()
    await flushPromises()
    let releaseFirst: (() => void) | null = null
    updateCard.mockImplementation(async (input) => {
      if (input.cardId === 'card-a') {
        await new Promise<void>((resolve) => { releaseFirst = resolve })
      }
      return updatedCard(input)
    })

    await wrapper.get('[data-card-id="card-a"] [data-field="title"]').setValue('Первый изменён')
    await wrapper.get('[data-card-id="card-b"] [data-field="title"]').setValue('Второй изменён')
    background()
    await flushPromises()

    expect(updateCard).toHaveBeenCalledTimes(1)
    expect(updateCard).toHaveBeenLastCalledWith(expect.objectContaining({ cardId: 'card-a' }))

    const release = releaseFirst as (() => void) | null
    release?.()
    await flushPromises()
    expect(updateCard).toHaveBeenCalledTimes(2)
    expect(updateCard).toHaveBeenLastCalledWith(expect.objectContaining({ cardId: 'card-b' }))
  })

  it('starts whole-script generation and confirms replacement of manual card cues', async () => {
    const {
      wrapper,
      startScriptGeneration,
      startCardGeneration,
      getScript,
      readScript,
      publishGeneration,
      generation,
    } = mountEditor()
    await flushPromises()

    await wrapper.get('[data-action="generate-script-cues"]').trigger('click')
    await flushPromises()
    expect(startScriptGeneration).toHaveBeenCalledWith(aggregate.id)
    expect(getScript).toHaveBeenCalledTimes(1)
    expect(readScript).toHaveBeenCalledTimes(1)

    publishGeneration({ ...generation, status: 'completed', completedCards: 2 })
    await flushPromises()
    expect(getScript).toHaveBeenCalledTimes(1)
    expect(readScript).toHaveBeenCalledTimes(2)

    await wrapper.get('[data-card-id="card-b"] [data-action="regenerate-card"]').trigger('click')
    expect(startCardGeneration).not.toHaveBeenCalled()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Заменить ручные тезисы')

    await wrapper.get('[role="dialog"] [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(startCardGeneration).toHaveBeenCalledWith({
      scriptId: aggregate.id,
      cardId: 'card-b',
      replaceManual: true,
    })
  })

  it('shows a safe generation error inside the affected card', async () => {
    const { wrapper, startCardGeneration } = mountEditor()
    await flushPromises()
    startCardGeneration.mockRejectedValueOnce(
      new Error('sensitive transport detail'),
    )

    await wrapper.get('[data-card-id="card-a"] [data-action="regenerate-card"]').trigger('click')
    await flushPromises()

    const firstCard = wrapper.get('[data-card-id="card-a"]')
    expect(firstCard.get('[data-generation-error]').text()).toContain(
      'Не удалось обновить тезисы. Полный текст и прежние тезисы сохранены.',
    )
    expect(firstCard.text()).not.toContain('sensitive transport detail')
  })
})
