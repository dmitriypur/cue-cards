import type { InjectionKey } from 'vue'

import type { GetScript } from '@/application/scripts/GetScript'
import type { ListScripts } from '@/application/scripts/ListScripts'
import type { UUID } from '@/domain/scripts/types'

export interface DeleteScriptPort {
  execute(scriptId: UUID): Promise<void>
  undo(scriptId: UUID): Promise<void>
}

export interface LibraryDependencies {
  readonly listScripts: Pick<ListScripts, 'execute'>
  readonly getScript: Pick<GetScript, 'execute'>
  readonly deleteScript: DeleteScriptPort
  isOnline(): boolean
}

export interface LibraryNavigation {
  openImport(): Promise<void>
  openEditor(scriptId: UUID): Promise<void>
  openRecording(scriptId: UUID): Promise<void>
}

export const libraryDependenciesKey: InjectionKey<LibraryDependencies> = Symbol('library-dependencies')
export const libraryNavigationKey: InjectionKey<LibraryNavigation> = Symbol('library-navigation')
