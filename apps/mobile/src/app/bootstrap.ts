import { Capacitor } from '@capacitor/core'
import { createPinia } from 'pinia'
import { v7 as uuidv7 } from 'uuid'
import { createApp } from 'vue'

import App from '@/App.vue'
import { createAppRouter } from '@/app/router'
import { ImportWorkflow } from '@/application/import/ImportWorkflow'
import { ParseSourceDocument } from '@/application/import/ParseSourceDocument'
import { SaveImportDraft } from '@/application/import/SaveImportDraft'
import { DeleteScript } from '@/application/scripts/DeleteScript'
import { GetScript } from '@/application/scripts/GetScript'
import { ListScripts } from '@/application/scripts/ListScripts'
import { SaveScriptAggregate } from '@/application/scripts/SaveScriptAggregate'
import {
  importNavigationKey,
  importWorkflowKey,
} from '@/features/import/import.dependencies'
import {
  libraryDependenciesKey,
  libraryNavigationKey,
  type LibraryDependencies,
} from '@/features/library/library.dependencies'
import { CapacitorSourceFilePicker } from '@/infrastructure/capacitor/CapacitorSourceFilePicker'
import { CapacitorSqlDriver } from '@/infrastructure/sqlite/CapacitorSqlDriver'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'
import { SqliteOutboxRepository } from '@/infrastructure/sqlite/SqliteOutboxRepository'
import { SqliteScriptRepository } from '@/infrastructure/sqlite/SqliteScriptRepository'

export async function bootstrapApp(): Promise<void> {
  const appRouter = createAppRouter()
  let importWorkflow: ImportWorkflow | null = null
  let libraryDependencies: LibraryDependencies | null = null

  if (Capacitor.isNativePlatform()) {
    const database = new CapacitorSqlDriver()
    await database.initialize()
    const scripts = new SqliteScriptRepository(database)
    const outbox = new SqliteOutboxRepository(database)
    const saveAggregate = new SaveScriptAggregate(
      scripts,
      outbox,
      new LocalUnitOfWork(database),
    )
    const saveDraft = new SaveImportDraft(
      saveAggregate,
      uuidv7,
      { now: () => new Date().toISOString() },
    )
    importWorkflow = new ImportWorkflow(
      new CapacitorSourceFilePicker(),
      new ParseSourceDocument(),
      saveDraft,
    )
    libraryDependencies = {
      listScripts: new ListScripts(scripts),
      getScript: new GetScript(scripts, saveAggregate),
      deleteScript: new DeleteScript(scripts, saveAggregate),
      isOnline: () => navigator.onLine,
    }
  }

  const app = createApp(App)

  app.use(createPinia())
  app.use(appRouter)
  if (importWorkflow !== null) app.provide(importWorkflowKey, importWorkflow)
  if (libraryDependencies !== null) {
    app.provide(libraryDependenciesKey, libraryDependencies)
  }
  app.provide(importNavigationKey, {
    openPreview: async () => { await appRouter.push('/import/preview') },
    openLibrary: async (scriptId?: string) => {
      await appRouter.push(scriptId === undefined ? '/library' : `/library?created=${scriptId}`)
    },
  })
  app.provide(libraryNavigationKey, {
    openImport: async () => { await appRouter.push('/import') },
    openEditor: async (scriptId: string) => { await appRouter.push(`/scripts/${scriptId}/edit`) },
    openRecording: async (scriptId: string) => { await appRouter.push(`/scripts/${scriptId}/record`) },
  })

  await appRouter.isReady()
  app.mount('#app')
}
