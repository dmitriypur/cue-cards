import { defineStore } from 'pinia'
import { v7 as uuidv7 } from 'uuid'

import { EditImportDraft } from '@/application/import/EditImportDraft'
import type { ImportDraft } from '@/domain/import/types'

const editor = new EditImportDraft(uuidv7)

function updateEmptyIssue(draft: ImportDraft, blockId: string, fullText: string): ImportDraft {
  const issues = draft.issues.filter(
    (issue) => !(issue.code === 'empty-block' && issue.blockId === blockId),
  )

  if (fullText.trim() === '') {
    const block = draft.blocks.find(({ id }) => id === blockId)
    issues.push({
      severity: 'error',
      code: 'empty-block',
      blockId,
      message: `Карточка «${block?.title ?? 'Без названия'}» не содержит текста.`,
    })
  }

  return { ...draft, issues }
}

export const useImportStore = defineStore('import', {
  state: () => ({
    draft: null as ImportDraft | null,
  }),
  getters: {
    hasErrors: (state): boolean => state.draft?.issues.some(({ severity }) => severity === 'error') ?? true,
  },
  actions: {
    setDraft(draft: ImportDraft): void {
      this.draft = draft
    },
    clearDraft(): void {
      this.draft = null
    },
    rename(title: string): void {
      if (this.draft !== null) this.draft = editor.rename(this.draft, title)
    },
    updateBlock(blockId: string, changes: { readonly title?: string; readonly fullText?: string }): void {
      if (this.draft === null) return

      const blocks = this.draft.blocks.map((block) => (
        block.id === blockId ? { ...block, ...changes } : block
      ))
      let nextDraft: ImportDraft = { ...this.draft, blocks }
      if (changes.fullText !== undefined) {
        nextDraft = updateEmptyIssue(nextDraft, blockId, changes.fullText)
      }
      this.draft = nextDraft
    },
    moveBlock(blockId: string, position: number): void {
      if (this.draft !== null) this.draft = editor.moveBlock(this.draft, blockId, position)
    },
    splitBlock(blockId: string, offset: number): void {
      if (this.draft !== null) this.draft = editor.splitBlock(this.draft, blockId, offset)
    },
    mergeWithNext(blockId: string): void {
      if (this.draft !== null) this.draft = editor.mergeWithNext(this.draft, blockId)
    },
    removeEmptyBlock(blockId: string): void {
      if (this.draft !== null) this.draft = editor.removeEmptyBlock(this.draft, blockId)
    },
  },
})
