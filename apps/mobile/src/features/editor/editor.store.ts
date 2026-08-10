import { defineStore } from 'pinia'

import type { EditorDependencies } from '@/features/editor/editor.dependencies'
import type { ScriptAggregate } from '@/domain/scripts/types'

export type EditorLoadState = 'idle' | 'loading' | 'ready' | 'failed'
export type EditorSaveState = 'saved' | 'pending' | 'saving' | 'failed'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    status: 'idle' as EditorLoadState,
    saveStatus: 'saved' as EditorSaveState,
    script: null as ScriptAggregate | null,
    error: null as string | null,
  }),
  actions: {
    async load(scriptId: string, dependencies: EditorDependencies): Promise<void> {
      this.status = 'loading'
      this.error = null
      try {
        this.script = await dependencies.getScript.execute(scriptId)
        this.status = 'ready'
      } catch {
        this.status = 'failed'
        this.error = 'Не удалось открыть локальный сценарий.'
      }
    },
    async refresh(scriptId: string, dependencies: EditorDependencies): Promise<void> {
      this.error = null
      try {
        this.script = await dependencies.readScript.execute(scriptId)
      } catch {
        this.error = 'Не удалось обновить локальный сценарий.'
      }
    },
    markPending(): void {
      this.saveStatus = 'pending'
    },
    async persist(work: () => Promise<ScriptAggregate>): Promise<void> {
      this.saveStatus = 'saving'
      this.error = null
      try {
        this.script = await work()
        this.saveStatus = 'saved'
      } catch {
        this.saveStatus = 'failed'
        this.error = 'Не удалось сохранить изменения локально.'
      }
    },
  },
})
