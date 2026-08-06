import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import ImportPreviewView from '@/features/import/ImportPreviewView.vue'
import { useImportStore } from '@/features/import/import.store'
import type { ImportDraft } from '@/domain/import/types'

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
    expect(buttonByName(wrapper, 'Сохранить').attributes('disabled')).toBeDefined()
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
})
