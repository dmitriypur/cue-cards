import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { TextScriptParser } from '@/application/import/TextScriptParser'

const fixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/script-heuristic.txt'),
  'utf8',
)

describe('TextScriptParser', () => {
  it('creates blocks only from short punctuation-free lines surrounded by blanks', () => {
    const draft = new TextScriptParser().parse('ролик.txt', fixture)

    expect(draft.title).toBe('ролик')
    expect(draft.blocks.map(({ title }) => title)).toEqual([
      'Сильное начало',
      'Покажите результат',
      'Финал',
    ])
    expect(draft.blocks[1]?.fullText).toContain('Это может быть заголовок')
  })

  it.each(['Строка.', 'Строка!', 'Строка?', 'Строка,', 'Строка:', 'Строка;'])(
    'does not treat %s as a heading',
    (line) => {
      const draft = new TextScriptParser().parse(
        'пунктуация.txt',
        `Начало\n\n${line}\n\nСледующая строка текста.`,
      )

      expect(draft.blocks).toHaveLength(1)
      expect(draft.blocks[0]?.fullText).toContain(line)
    },
  )

  it('warns when a heading-like line is not isolated by blank lines', () => {
    const draft = new TextScriptParser().parse('ролик.txt', fixture)

    expect(draft.issues).toContainEqual({
      severity: 'warning',
      code: 'ambiguous-structure',
      blockId: 'block-2',
      message: 'Строка «Это может быть заголовок» похожа на заголовок, но не отделена пустыми строками.',
    })
  })

  it('does not consider lines longer than 80 characters heading candidates', () => {
    const longLine = 'Очень длинная строка без пунктуации '.repeat(3).trim()
    const draft = new TextScriptParser().parse(
      'длина.txt',
      `Начало\n\n${longLine}\n\nОбычный текст.`,
    )

    expect(draft.blocks).toHaveLength(1)
    expect(draft.blocks[0]?.fullText).toContain(longLine)
  })
})
