import type {
  ImportBlock,
  ImportIssue,
  ParsedImportDraft,
} from '@/domain/import/types'

function filenameWithoutExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

function trimBlankLines(lines: readonly string[]): string {
  let start = 0
  let end = lines.length

  while (start < end && lines[start]?.trim() === '') start += 1
  while (end > start && lines[end - 1]?.trim() === '') end -= 1

  return lines.slice(start, end).join('\n')
}

export class MarkdownScriptParser {
  public parse(sourceName: string, sourceText: string): ParsedImportDraft {
    const normalizedText = sourceText.replace(/\r\n?/g, '\n')
    const lines = normalizedText.split('\n')
    const blocks: ImportBlock[] = []
    let title = filenameWithoutExtension(sourceName)
    let currentTitle: string | null = null
    let currentLines: string[] = []

    const finishBlock = (): void => {
      if (currentTitle === null) return

      blocks.push({
        id: `block-${blocks.length + 1}`,
        title: currentTitle,
        fullText: trimBlankLines(currentLines),
      })
    }

    for (const line of lines) {
      const levelOne = /^#\s+([^#].*)$/.exec(line)
      const levelTwo = /^##\s+([^#].*)$/.exec(line)

      if (levelTwo?.[1] !== undefined) {
        finishBlock()
        currentTitle = levelTwo[1].trim()
        currentLines = []
        continue
      }

      if (currentTitle === null && levelOne?.[1] !== undefined) {
        title = levelOne[1].trim()
        continue
      }

      if (currentTitle !== null) currentLines.push(line)
    }

    finishBlock()

    const issues: ImportIssue[] = blocks
      .filter(({ fullText }) => fullText.trim() === '')
      .map((block) => ({
        severity: 'error',
        code: 'empty-block',
        blockId: block.id,
        message: `Карточка «${block.title}» не содержит текста.`,
      }))

    return {
      title,
      sourceName,
      sourceFormat: 'markdown',
      sourceText: normalizedText,
      blocks,
      issues,
    }
  }
}
