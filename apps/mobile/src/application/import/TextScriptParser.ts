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

function isHeadingShape(line: string): boolean {
  const candidate = line.trim()

  return candidate.length >= 1
    && candidate.length <= 80
    && !/[.!?,:;]$/u.test(candidate)
}

export class TextScriptParser {
  public parse(sourceName: string, sourceText: string): ParsedImportDraft {
    const normalizedText = sourceText.replace(/\r\n?/g, '\n')
    const lines = normalizedText.split('\n')
    const blocks: ImportBlock[] = []
    const issues: ImportIssue[] = []
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

    lines.forEach((line, index) => {
      const previousIsBlank = index === 0 || lines[index - 1]?.trim() === ''
      const nextIsBlank = index === lines.length - 1 || lines[index + 1]?.trim() === ''
      const headingShape = isHeadingShape(line)

      if (headingShape && previousIsBlank && nextIsBlank) {
        finishBlock()
        currentTitle = line.trim()
        currentLines = []
        return
      }

      if (headingShape && previousIsBlank !== nextIsBlank && currentTitle !== null) {
        issues.push({
          severity: 'warning',
          code: 'ambiguous-structure',
          blockId: `block-${blocks.length + 1}`,
          message: `Строка «${line.trim()}» похожа на заголовок, но не отделена пустыми строками.`,
        })
      }

      if (currentTitle !== null) currentLines.push(line)
    })

    finishBlock()

    if (blocks.length === 0 && normalizedText.trim() !== '') {
      blocks.push({
        id: 'block-1',
        title: filenameWithoutExtension(sourceName),
        fullText: normalizedText.trim(),
      })
    }

    return {
      title: filenameWithoutExtension(sourceName),
      sourceName,
      sourceFormat: 'text',
      sourceText: normalizedText,
      blocks,
      issues,
    }
  }
}
