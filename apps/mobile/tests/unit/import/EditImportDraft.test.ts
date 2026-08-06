import { describe, expect, it } from 'vitest'

import { EditImportDraft } from '@/application/import/EditImportDraft'
import type { ImportDraft } from '@/domain/import/types'

const draft: ImportDraft = {
  title: 'Исходный заголовок',
  sourceName: 'сценарий.md',
  sourceFormat: 'markdown',
  sourceText: '# Исходный заголовок',
  importHash: 'hash',
  blocks: [
    { id: 'a', title: 'Первый', fullText: 'Первая часть.\nВторая часть.' },
    { id: 'b', title: 'Второй', fullText: 'Продолжение.' },
    { id: 'c', title: 'Пустой', fullText: '' },
  ],
  issues: [
    { severity: 'error', code: 'empty-block', blockId: 'c', message: 'Пусто.' },
  ],
}

describe('EditImportDraft', () => {
  it('renames the script without mutating the previous draft', () => {
    const result = new EditImportDraft(() => 'new').rename(draft, 'Новое название')

    expect(result.title).toBe('Новое название')
    expect(draft.title).toBe('Исходный заголовок')
  })

  it('moves a block to a requested position', () => {
    const result = new EditImportDraft(() => 'new').moveBlock(draft, 'b', 0)

    expect(result.blocks.map(({ id }) => id)).toEqual(['b', 'a', 'c'])
  })

  it('splits a block at a text offset and creates a stable new block', () => {
    const result = new EditImportDraft(() => 'new').splitBlock(draft, 'a', 13)

    expect(result.blocks.slice(0, 2)).toEqual([
      { id: 'a', title: 'Первый', fullText: 'Первая часть.' },
      { id: 'new', title: 'Первый — продолжение', fullText: 'Вторая часть.' },
    ])
  })

  it('merges a block with the next block and removes its issues', () => {
    const result = new EditImportDraft(() => 'new').mergeWithNext(draft, 'b')

    expect(result.blocks[1]).toEqual({
      id: 'b',
      title: 'Второй',
      fullText: 'Продолжение.',
    })
    expect(result.blocks).toHaveLength(2)
    expect(result.issues).toEqual([])
  })

  it('removes only an empty block and its validation issue', () => {
    const editor = new EditImportDraft(() => 'new')

    expect(editor.removeEmptyBlock(draft, 'c').blocks.map(({ id }) => id)).toEqual(['a', 'b'])
    expect(() => editor.removeEmptyBlock(draft, 'b')).toThrow('Можно удалить только пустой блок.')
  })
})
