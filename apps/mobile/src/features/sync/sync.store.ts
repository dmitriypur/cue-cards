import { defineStore } from 'pinia'

import type { SyncRunState, RunSync } from '@/application/sync/RunSync'

export const useSyncStore = defineStore('sync', {
  state: () => ({
    state: 'up-to-date' as SyncRunState,
    lastError: null as string | null,
  }),
  actions: {
    async run(action: Pick<RunSync, 'execute'>, reason: 'startup' | 'connectivity' | 'manual'): Promise<void> {
      this.state = 'syncing'
      this.lastError = null
      try {
        this.state = (await action.execute(reason)).state
      } catch (error: unknown) {
        this.state = 'retrying'
        this.lastError = error instanceof Error ? error.message : 'Синхронизация не выполнена.'
      }
    },
  },
})
