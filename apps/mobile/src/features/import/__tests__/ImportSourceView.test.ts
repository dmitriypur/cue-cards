import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { ImportWorkflow } from '@/application/import/ImportWorkflow'
import type { ImportDraft } from '@/domain/import/types'
import ImportSourceView from '@/features/import/ImportSourceView.vue'
import {
  importNavigationKey,
  importWorkflowKey,
} from '@/features/import/import.dependencies'
import { useImportStore } from '@/features/import/import.store'

const draft: ImportDraft = {
  title: 'Сценарий',
  sourceName: 'сценарий.md',
  sourceFormat: 'markdown',
  sourceText: '# Сценарий',
  importHash: 'hash',
  blocks: [{ id: 'a', title: 'Начало', fullText: 'Текст.' }],
  issues: [],
}

describe('ImportSourceView', () => {
  it('keeps the parsed draft in memory and opens preview', async () => {
    const pinia = createPinia()
    let previewOpened = false
    const workflow = new ImportWorkflow(
      {
        pick: async () => ({
          name: 'сценарий.md',
          mimeType: 'text/markdown',
          size: 10,
          text: '# Сценарий',
        }),
      },
      { execute: async () => draft },
      { execute: async () => 'script-id' },
    )
    const wrapper = mount(ImportSourceView, {
      global: {
        plugins: [pinia],
        provide: {
          [importWorkflowKey as symbol]: workflow,
          [importNavigationKey as symbol]: {
            openPreview: async () => { previewOpened = true },
            openLibrary: async () => undefined,
          },
        },
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(useImportStore(pinia).draft).toEqual(draft)
    expect(previewOpened).toBe(true)
  })
})
