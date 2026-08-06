import type {
  Clock,
  SaveScriptInput,
} from '@/application/scripts/SaveScriptAggregate'
import type { ImportDraft } from '@/domain/import/types'
import { sha256 } from '@/domain/scripts/contentHash'
import type { ScriptAggregate, ScriptCard, UUID } from '@/domain/scripts/types'

interface ScriptAggregateSaver {
  execute(input: SaveScriptInput): Promise<ScriptAggregate>
}

export class SaveImportDraft {
  private readonly saver: ScriptAggregateSaver
  private readonly createId: () => UUID
  private readonly clock: Clock

  public constructor(saver: ScriptAggregateSaver, createId: () => UUID, clock: Clock) {
    this.saver = saver
    this.createId = createId
    this.clock = clock
  }

  public async execute(draft: ImportDraft): Promise<ScriptAggregate> {
    if (draft.issues.some(({ severity }) => severity === 'error')) {
      throw new Error('Исправьте ошибки импорта перед сохранением.')
    }
    if (draft.title.trim() === '' || draft.blocks.length === 0) {
      throw new Error('Название и хотя бы одна карточка обязательны.')
    }

    const now = this.clock.now()
    const scriptId = this.createId()
    const cards: ScriptCard[] = []

    for (const [position, block] of draft.blocks.entries()) {
      const cardId = this.createId()
      const cueSetId = this.createId()
      cards.push({
        id: cardId,
        scriptId,
        position,
        title: block.title.trim(),
        fullText: block.fullText,
        contentHash: await sha256(block.fullText),
        version: 0,
        cueSet: {
          id: cueSetId,
          cardId,
          cues: [],
          sourceHash: null,
          status: 'missing',
          generationId: null,
          manuallyEdited: false,
          version: 0,
          createdAt: now,
          updatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
    }

    const aggregate: ScriptAggregate = {
      id: scriptId,
      title: draft.title.trim(),
      sourceFormat: draft.sourceFormat,
      sourceText: draft.sourceText,
      importHash: draft.importHash,
      serverVersion: 0,
      syncStatus: 'pending',
      cards,
      lastOpenedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    return this.saver.execute({ aggregate })
  }
}
