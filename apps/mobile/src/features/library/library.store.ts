import { defineStore } from 'pinia'

import type { ListScripts } from '@/application/scripts/ListScripts'
import type { ScriptSummary } from '@/domain/scripts/types'

export type LibraryLoadState = 'idle' | 'loading' | 'ready' | 'failed'

export const useLibraryStore = defineStore('library', {
  state: () => ({
    status: 'idle' as LibraryLoadState,
    scripts: [] as ScriptSummary[],
    error: null as string | null,
    pendingUndo: null as { readonly script: ScriptSummary; readonly index: number } | null,
  }),
  actions: {
    async load(listScripts: Pick<ListScripts, 'execute'>): Promise<void> {
      this.status = 'loading'
      this.error = null

      try {
        this.scripts = [...await listScripts.execute()]
        this.status = 'ready'
      } catch (reason) {
        this.status = 'failed'
        this.error = reason instanceof Error
          ? reason.message
          : 'Не удалось загрузить локальную библиотеку.'
      }
    },
    removeForUndo(scriptId: string): void {
      const index = this.scripts.findIndex(({ id }) => id === scriptId)
      if (index < 0) return
      const script = this.scripts[index]
      if (script === undefined) return
      this.pendingUndo = { script, index }
      this.scripts.splice(index, 1)
    },
    restorePendingUndo(): void {
      if (this.pendingUndo === null) return
      this.scripts.splice(this.pendingUndo.index, 0, this.pendingUndo.script)
      this.pendingUndo = null
    },
  },
})
