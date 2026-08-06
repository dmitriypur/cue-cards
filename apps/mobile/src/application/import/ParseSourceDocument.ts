import { MarkdownScriptParser } from '@/application/import/MarkdownScriptParser'
import { TextScriptParser } from '@/application/import/TextScriptParser'
import { sha256 } from '@/domain/scripts/contentHash'
import type { ImportDraft, SourceDocument } from '@/domain/import/types'

export type SourceDocumentErrorCode = 'unsupported-file' | 'empty-file' | 'file-too-large'

export class SourceDocumentValidationError extends Error {
  public readonly code: SourceDocumentErrorCode

  public constructor(code: SourceDocumentErrorCode, message: string) {
    super(message)
    this.name = 'SourceDocumentValidationError'
    this.code = code
  }
}

const MAX_SOURCE_BYTES = 1_048_576

export class ParseSourceDocument {
  public async execute(source: SourceDocument): Promise<ImportDraft> {
    const extension = source.name.toLocaleLowerCase().match(/\.([^.]+)$/u)?.[1]

    if (extension !== 'md' && extension !== 'txt') {
      throw new SourceDocumentValidationError(
        'unsupported-file',
        'Можно импортировать только файлы .md и .txt.',
      )
    }

    const actualSize = new TextEncoder().encode(source.text).byteLength
    if (source.size > MAX_SOURCE_BYTES || actualSize > MAX_SOURCE_BYTES) {
      throw new SourceDocumentValidationError(
        'file-too-large',
        'Размер файла превышает 1 МиБ.',
      )
    }

    if (source.text.trim() === '') {
      throw new SourceDocumentValidationError('empty-file', 'Файл не содержит текста.')
    }

    const parsed = extension === 'md'
      ? new MarkdownScriptParser().parse(source.name, source.text)
      : new TextScriptParser().parse(source.name, source.text)

    return {
      ...parsed,
      importHash: await sha256(parsed.sourceText),
    }
  }
}
