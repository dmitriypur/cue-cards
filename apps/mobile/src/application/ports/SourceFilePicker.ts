import type { SourceDocument } from '@/domain/import/types'

export interface SourceFilePicker {
  pick(): Promise<SourceDocument | null>
}
