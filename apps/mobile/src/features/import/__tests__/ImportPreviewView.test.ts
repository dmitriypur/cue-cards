import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import ImportPreviewView from '@/features/import/ImportPreviewView.vue'
import { useImportStore } from '@/features/import/import.store'
import type { ImportDraft } from '@/domain/import/types'
import { ImportWorkflow } from '@/application/import/ImportWorkflow'
import { aiCuesDependenciesKey } from '@/features/ai-cues/aiCues.dependencies'
import {
  importNavigationKey,
  importWorkflowKey,
} from '@/features/import/import.dependencies'

const draft: ImportDraft = {
  title: 'Сценарий',
  sourceName: 'сценарий.md',
  sourceFormat: 'markdown',
  sourceText: '# Сценарий',
  importHash: 'hash',
  blocks: [
    { id: 'a', title: 'Первый', fullText: 'Первая часть.\nВторая часть.' },
    { id: 'b', title: 'Второй', fullText: 'Продолжение.' },
    { id: 'c', title: 'Пустой', fullText: '' },
  ],
  issues: [
    {
      severity: 'warning',
      code: 'ambiguous-structure',
      blockId: 'b',
      message: 'Структура второго блока неоднозначна.',
    },
    {
      severity: 'error',
      code: 'empty-block',
      blockId: 'c',
      message: 'Пустой блок нужно исправить.',
    },
  ],
}

function mountPreview(initialDraft: ImportDraft = draft) {
  const pinia = createPinia()
  const store = useImportStore(pinia)
  store.setDraft(initialDraft)
  const wrapper = mount(ImportPreviewView, {
    global: { plugins: [pinia] },
  })
  return { wrapper, store }
}

function buttonByName(wrapper: ReturnType<typeof mountPreview>['wrapper'], name: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === name)
  if (button === undefined) throw new Error(`Button not found: ${name}`)
  return button
}

describe('ImportPreviewView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows warnings and errors on semantic surfaces and disables Save for errors', () => {
    const { wrapper } = mountPreview()

    expect(wrapper.text()).toContain('Структура второго блока неоднозначна.')
    expect(wrapper.text()).toContain('Пустой блок нужно исправить.')
    expect(wrapper.get('[data-issue-severity="warning"]').classes()).toContain('text-surface-foreground')
    expect(wrapper.get('[data-issue-severity="error"]').classes()).toContain('text-surface-foreground')
    expect(buttonByName(wrapper, 'Сохранить и создать тезисы').attributes('disabled')).toBeDefined()
    expect(buttonByName(wrapper, 'Сохранить без ИИ').attributes('disabled')).toBeDefined()
  })

  it('splits a block at the textarea cursor', async () => {
    const { wrapper, store } = mountPreview({ ...draft, issues: [], blocks: draft.blocks.slice(0, 2) })
    const textarea = wrapper.findAll('textarea')[0]
    const element = textarea?.element
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Textarea not found')
    element.setSelectionRange(13, 13)

    await buttonByName(wrapper, 'Разделить').trigger('click')

    expect(store.draft?.blocks.map(({ fullText }) => fullText)).toEqual([
      'Первая часть.',
      'Вторая часть.',
      'Продолжение.',
    ])
  })

  it('merges a block with the next one', async () => {
    const { wrapper, store } = mountPreview({ ...draft, issues: [], blocks: draft.blocks.slice(0, 2) })

    await buttonByName(wrapper, 'Объединить со следующим').trigger('click')

    expect(store.draft?.blocks).toHaveLength(1)
    expect(store.draft?.blocks[0]?.fullText).toBe('Первая часть.\nВторая часть.\n\nПродолжение.')
  })

  it('moves a block upward', async () => {
    const { wrapper, store } = mountPreview({ ...draft, issues: [], blocks: draft.blocks.slice(0, 2) })

    await buttonByName(wrapper, 'Вверх').trigger('click')

    expect(store.draft?.blocks.map(({ id }) => id)).toEqual(['b', 'a'])
  })

  it('saves locally before requesting AI cues and then opens the saved script', async () => {
    const events: string[] = []
    const pinia = createPinia()
    const store = useImportStore(pinia)
    store.setDraft({ ...draft, issues: [], blocks: draft.blocks.slice(0, 2) })
    const workflow = new ImportWorkflow(
      { pick: async () => null },
      { execute: async () => draft },
      { execute: async () => { events.push('save-local'); return 'script-created' } },
    )
    const wrapper = mount(ImportPreviewView, {
      global: {
        plugins: [pinia],
        provide: {
          [importWorkflowKey as symbol]: workflow,
          [importNavigationKey as symbol]: {
            openPreview: async () => undefined,
            openLibrary: async (scriptId?: string) => { events.push(`open:${scriptId ?? ''}`) },
          },
          [aiCuesDependenciesKey as symbol]: {
            startScript: {
              execute: async (scriptId: string) => {
                events.push(`start-ai:${scriptId}`)
                return { state: 'waiting-for-network' as const, generation: null }
              },
            },
            startCard: { execute: async () => { throw new Error('unexpected card generation') } },
            refresh: {
              execute: async () => { throw new Error('unexpected refresh') },
              track: () => () => undefined,
            },
          },
        },
      },
    })

    await buttonByName(wrapper, 'Сохранить и создать тезисы').trigger('click')
    await flushPromises()

    expect(events).toEqual(['save-local', 'start-ai:script-created', 'open:script-created'])
  })

  it('can save locally without starting AI', async () => {
    const events: string[] = []
    const pinia = createPinia()
    const store = useImportStore(pinia)
    store.setDraft({ ...draft, issues: [], blocks: draft.blocks.slice(0, 2) })
    const workflow = new ImportWorkflow(
      { pick: async () => null },
      { execute: async () => draft },
      { execute: async () => { events.push('save-local'); return 'script-created' } },
    )
    const wrapper = mount(ImportPreviewView, {
      global: {
        plugins: [pinia],
        provide: {
          [importWorkflowKey as symbol]: workflow,
          [importNavigationKey as symbol]: {
            openPreview: async () => undefined,
            openLibrary: async () => { events.push('open') },
          },
        },
      },
    })

    await buttonByName(wrapper, 'Сохранить без ИИ').trigger('click')
    await flushPromises()

    expect(events).toEqual(['save-local', 'open'])
  })
})
