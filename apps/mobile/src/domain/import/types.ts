import type { SourceFormat } from '@/domain/scripts/types'

export type ImportIssueSeverity = 'warning' | 'error'

export interface ImportIssue {
  readonly severity: ImportIssueSeverity
  readonly code: 'empty-block' | 'ambiguous-structure' | 'unsupported-file' | 'empty-file' | 'file-too-large'
  readonly blockId: string | null
  readonly message: string
}

export interface ImportBlock {
  readonly id: string
  readonly title: string
  readonly fullText: string
}

export interface ParsedImportDraft {
  readonly title: string
  readonly sourceName: string
  readonly sourceFormat: SourceFormat
  readonly sourceText: string
  readonly blocks: readonly ImportBlock[]
  readonly issues: readonly ImportIssue[]
}

export interface ImportDraft extends ParsedImportDraft {
  readonly importHash: string
}

export interface SourceDocument {
  readonly name: string
  readonly mimeType: string
  readonly size: number
  readonly text: string
}
