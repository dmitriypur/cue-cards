import type { InjectionKey } from 'vue'

import type { ConflictRepository } from '@/application/ports/ConflictRepository'
import type { ResolveConflict } from '@/application/sync/ResolveConflict'
import type { RunSync } from '@/application/sync/RunSync'

export interface SyncDependencies {
  readonly conflicts: Pick<ConflictRepository, 'get' | 'list'>
  readonly resolveConflict: Pick<ResolveConflict, 'useServer' | 'duplicateLocal'>
  readonly runSync: Pick<RunSync, 'execute'>
}

export interface SyncNavigation {
  openLibrary(focusIds: readonly string[]): Promise<void>
  openConflict(conflictId: string): Promise<void>
  openLogin(): Promise<void>
}

export const syncDependenciesKey: InjectionKey<SyncDependencies> = Symbol('sync-dependencies')
export const syncNavigationKey: InjectionKey<SyncNavigation> = Symbol('sync-navigation')
