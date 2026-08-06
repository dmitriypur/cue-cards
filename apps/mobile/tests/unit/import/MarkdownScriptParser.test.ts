import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MarkdownScriptParser } from '@/application/import/MarkdownScriptParser'

const fixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/script-structured.md'),
  'utf8',
)

describe('MarkdownScriptParser', () => {
  it('uses the level-one heading as title and level-two headings as cards', () => {
    const draft = new MarkdownScriptParser().parse('черновик.md', fixture)

    expect(draft.title).toBe('Сценарий о внимании')
    expect(draft.blocks.map(({ title }) => title)).toEqual([
      'Крючок',
      'Основная мысль',
      'Завершение',
    ])
    expect(draft.blocks[1]?.fullText).toBe(
      'Сначала покажите результат, затем объясните путь к нему.\n\n### Важная деталь\n\nОдин смысловой блок должен отвечать на один вопрос.',
    )
  })

  it('falls back to the filename when the document has no level-one heading', () => {
    const draft = new MarkdownScriptParser().parse(
      'запасной-сценарий.md',
      '## Начало\r\n\r\nТекст карточки.\r\n',
    )

    expect(draft.title).toBe('запасной-сценарий')
    expect(draft.blocks[0]?.fullText).toBe('Текст карточки.')
  })

  it('reports every empty level-two block as a validation error', () => {
    const draft = new MarkdownScriptParser().parse(
      'пустой.md',
      '# Проверка\n\n## Пустая карточка\n\n## Заполненная\n\nЕсть текст.\n',
    )

    expect(draft.issues).toEqual([
      {
        severity: 'error',
        code: 'empty-block',
        blockId: draft.blocks[0]?.id,
        message: 'Карточка «Пустая карточка» не содержит текста.',
      },
    ])
  })
})
