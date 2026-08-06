import type { InjectionKey } from 'vue'

import type { ImportWorkflow } from '@/application/import/ImportWorkflow'

export interface ImportNavigation {
  openPreview(): Promise<void>
  openLibrary(scriptId?: string): Promise<void>
}

export const importWorkflowKey: InjectionKey<ImportWorkflow> = Symbol('import-workflow')
export const importNavigationKey: InjectionKey<ImportNavigation> = Symbol('import-navigation')
