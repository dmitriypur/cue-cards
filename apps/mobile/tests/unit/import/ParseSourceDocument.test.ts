import { describe, expect, it } from 'vitest'

import {
  ParseSourceDocument,
  SourceDocumentValidationError,
} from '@/application/import/ParseSourceDocument'

const markdownText = '# Тест\n\n## Блок\n\nПривет'

describe('ParseSourceDocument', () => {
  it('parses Markdown and adds a SHA-256 import hash', async () => {
    const draft = await new ParseSourceDocument().execute({
      name: 'тест.md',
      mimeType: 'text/markdown',
      size: new TextEncoder().encode(markdownText).byteLength,
      text: markdownText,
    })

    expect(draft.sourceFormat).toBe('markdown')
    expect(draft.importHash).toBe(
      '14a341db2629c3331145fb38084f92b21374767d3ce2c638b6ccfb3d600e0f8d',
    )
  })

  it.each([
    ['unsupported-file', { name: 'тест.pdf', mimeType: 'application/pdf', size: 4, text: 'тест' }],
    ['empty-file', { name: 'тест.txt', mimeType: 'text/plain', size: 0, text: '   \n' }],
    ['file-too-large', { name: 'тест.txt', mimeType: 'text/plain', size: 1_048_577, text: 'тест' }],
  ] as const)('rejects invalid input with %s', async (code, source) => {
    const action = new ParseSourceDocument()

    await expect(action.execute(source)).rejects.toEqual(
      expect.objectContaining<Partial<SourceDocumentValidationError>>({ code }),
    )
  })

  it('chooses the parser by extension without trusting the MIME type', async () => {
    const draft = await new ParseSourceDocument().execute({
      name: 'заметки.txt',
      mimeType: 'application/octet-stream',
      size: 30,
      text: 'Начало\n\nОбычный текст.',
    })

    expect(draft.sourceFormat).toBe('text')
  })

  it('enforces the byte limit even when file metadata understates the size', async () => {
    const action = new ParseSourceDocument()

    await expect(action.execute({
      name: 'слишком-большой.txt',
      mimeType: 'text/plain',
      size: 1,
      text: 'а'.repeat(524_289),
    })).rejects.toEqual(
      expect.objectContaining<Partial<SourceDocumentValidationError>>({ code: 'file-too-large' }),
    )
  })
})
