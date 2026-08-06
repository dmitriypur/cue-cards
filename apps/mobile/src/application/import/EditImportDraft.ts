import type { ImportBlock, ImportDraft } from '@/domain/import/types'

export class EditImportDraft {
  private readonly createBlockId: () => string

  public constructor(createBlockId: () => string) {
    this.createBlockId = createBlockId
  }

  public rename(draft: ImportDraft, title: string): ImportDraft {
    return { ...draft, title: title.trim() }
  }

  public moveBlock(draft: ImportDraft, blockId: string, nextPosition: number): ImportDraft {
    const currentPosition = draft.blocks.findIndex(({ id }) => id === blockId)
    if (currentPosition < 0) return draft

    const blocks = [...draft.blocks]
    const [block] = blocks.splice(currentPosition, 1)
    if (block === undefined) return draft

    const boundedPosition = Math.max(0, Math.min(nextPosition, blocks.length))
    blocks.splice(boundedPosition, 0, block)

    return { ...draft, blocks }
  }

  public splitBlock(draft: ImportDraft, blockId: string, offset: number): ImportDraft {
    const position = draft.blocks.findIndex(({ id }) => id === blockId)
    const block = draft.blocks[position]
    if (block === undefined) return draft

    const firstText = block.fullText.slice(0, offset).trim()
    const secondText = block.fullText.slice(offset).trim()
    if (firstText === '' || secondText === '') {
      throw new Error('Обе части разделённого блока должны содержать текст.')
    }

    const blocks = [...draft.blocks]
    blocks.splice(
      position,
      1,
      { ...block, fullText: firstText },
      {
        id: this.createBlockId(),
        title: `${block.title} — продолжение`,
        fullText: secondText,
      },
    )

    return { ...draft, blocks }
  }

  public mergeWithNext(draft: ImportDraft, blockId: string): ImportDraft {
    const position = draft.blocks.findIndex(({ id }) => id === blockId)
    const block = draft.blocks[position]
    const nextBlock = draft.blocks[position + 1]
    if (block === undefined || nextBlock === undefined) return draft

    const fullText = [block.fullText.trim(), nextBlock.fullText.trim()]
      .filter((part) => part !== '')
      .join('\n\n')
    const merged: ImportBlock = { ...block, fullText }
    const blocks = [...draft.blocks]
    blocks.splice(position, 2, merged)

    return {
      ...draft,
      blocks,
      issues: draft.issues.filter(({ blockId: issueBlockId }) => issueBlockId !== nextBlock.id),
    }
  }

  public removeEmptyBlock(draft: ImportDraft, blockId: string): ImportDraft {
    const block = draft.blocks.find(({ id }) => id === blockId)
    if (block === undefined) return draft
    if (block.fullText.trim() !== '') {
      throw new Error('Можно удалить только пустой блок.')
    }

    return {
      ...draft,
      blocks: draft.blocks.filter(({ id }) => id !== blockId),
      issues: draft.issues.filter(({ blockId: issueBlockId }) => issueBlockId !== blockId),
    }
  }
}
