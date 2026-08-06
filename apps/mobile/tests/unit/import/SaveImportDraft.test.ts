import { describe, expect, it } from 'vitest'

import { SaveImportDraft } from '@/application/import/SaveImportDraft'
import type { SaveScriptInput } from '@/application/scripts/SaveScriptAggregate'
import type { ImportDraft } from '@/domain/import/types'
import type { ScriptAggregate } from '@/domain/scripts/types'

const validDraft: ImportDraft = {
  title: 'Готовый сценарий',
  sourceName: 'сценарий.md',
  sourceFormat: 'markdown',
  sourceText: '# Готовый сценарий',
  importHash: 'import-hash',
  blocks: [
    { id: 'draft-a', title: 'Первый', fullText: 'Первый текст.' },
    { id: 'draft-b', title: 'Второй', fullText: 'Второй текст.' },
  ],
  issues: [],
}

describe('SaveImportDraft', () => {
  it('creates client identifiers and persists a local aggregate through SaveScriptAggregate', async () => {
    const ids = ['script-id', 'card-a', 'cue-a', 'card-b', 'cue-b']
    let savedInput: SaveScriptInput | null = null
    const saver = {
      async execute(input: SaveScriptInput): Promise<ScriptAggregate> {
        savedInput = input
        return input.aggregate
      },
    }
    const action = new SaveImportDraft(
      saver,
      () => ids.shift() ?? 'unexpected-id',
      { now: () => '2026-08-06T09:00:00.000Z' },
    )

    const aggregate = await action.execute(validDraft)

    expect(savedInput).toEqual({ aggregate })
    expect(aggregate).toMatchObject({
      id: 'script-id',
      title: 'Готовый сценарий',
      sourceFormat: 'markdown',
      sourceText: '# Готовый сценарий',
      importHash: 'import-hash',
      serverVersion: 0,
      syncStatus: 'pending',
      cards: [
        {
          id: 'card-a',
          position: 0,
          title: 'Первый',
          fullText: 'Первый текст.',
          contentHash: '86932cc3b03c36b1cb68d4365c598721ec7f9b6bd5aa5952bb0a0f06d4ac4c28',
          cueSet: { id: 'cue-a', cues: [], status: 'missing' },
        },
        {
          id: 'card-b',
          position: 1,
          title: 'Второй',
          fullText: 'Второй текст.',
          contentHash: '703029c62a6857db47e5f65f9642924c31f32112fdfaf59549d3b24336f78575',
          cueSet: { id: 'cue-b', cues: [], status: 'missing' },
        },
      ],
    })
  })

  it('refuses to persist a draft with validation errors', async () => {
    const action = new SaveImportDraft(
      { execute: async ({ aggregate }) => aggregate },
      () => 'id',
      { now: () => '2026-08-06T09:00:00.000Z' },
    )

    await expect(action.execute({
      ...validDraft,
      issues: [{ severity: 'error', code: 'empty-block', blockId: 'draft-a', message: 'Пусто.' }],
    })).rejects.toThrow('Исправьте ошибки импорта перед сохранением.')
  })
})
