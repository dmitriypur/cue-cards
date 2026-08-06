import { describe, expect, it } from 'vitest'

import { ImportWorkflow } from '@/application/import/ImportWorkflow'
import type { ImportDraft } from '@/domain/import/types'

const draft: ImportDraft = {
  title: 'Сценарий',
  sourceName: 'сценарий.txt',
  sourceFormat: 'text',
  sourceText: 'Начало\n\nТекст.',
  importHash: 'hash',
  blocks: [{ id: 'block-1', title: 'Начало', fullText: 'Текст.' }],
  issues: [],
}

describe('ImportWorkflow', () => {
  it('returns null when file selection is cancelled', async () => {
    const workflow = new ImportWorkflow(
      { pick: async () => null },
      { execute: async () => draft },
      { execute: async () => 'script-id' },
    )

    await expect(workflow.pickDraft()).resolves.toBeNull()
  })

  it('parses the selected source and saves only the approved draft', async () => {
    const source = { name: 'сценарий.txt', mimeType: 'text/plain', size: 25, text: 'Начало\n\nТекст.' }
    let savedDraft: ImportDraft | null = null
    const workflow = new ImportWorkflow(
      { pick: async () => source },
      { execute: async (input) => input === source ? draft : Promise.reject(new Error('wrong source')) },
      {
        async execute(input) {
          savedDraft = input
          return 'script-id'
        },
      },
    )

    await expect(workflow.pickDraft()).resolves.toEqual(draft)
    await expect(workflow.saveDraft(draft)).resolves.toBe('script-id')
    expect(savedDraft).toBe(draft)
  })
})
