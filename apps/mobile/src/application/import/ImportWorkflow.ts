import type { SourceFilePicker } from '@/application/ports/SourceFilePicker'
import type { ImportDraft, SourceDocument } from '@/domain/import/types'
import type { UUID } from '@/domain/scripts/types'

interface SourceDocumentParser {
  execute(source: SourceDocument): Promise<ImportDraft>
}

interface ImportDraftSaver {
  execute(draft: ImportDraft): Promise<{ readonly id: UUID } | UUID>
}

export class ImportWorkflow {
  private readonly picker: SourceFilePicker
  private readonly parser: SourceDocumentParser
  private readonly saver: ImportDraftSaver

  public constructor(
    picker: SourceFilePicker,
    parser: SourceDocumentParser,
    saver: ImportDraftSaver,
  ) {
    this.picker = picker
    this.parser = parser
    this.saver = saver
  }

  public async pickDraft(): Promise<ImportDraft | null> {
    const source = await this.picker.pick()
    return source === null ? null : this.parser.execute(source)
  }

  public async saveDraft(draft: ImportDraft): Promise<UUID> {
    const saved = await this.saver.execute(draft)
    return typeof saved === 'string' ? saved : saved.id
  }
}
