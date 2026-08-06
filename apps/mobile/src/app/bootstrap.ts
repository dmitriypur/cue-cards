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
import { FinishRecording } from '@/application/recording/FinishRecording'
import { MoveRecordingCursor } from '@/application/recording/MoveRecordingCursor'
import { StartRecording } from '@/application/recording/StartRecording'
import { UpdateRecordingDisplay } from '@/application/recording/UpdateRecordingDisplay'
import { GetScript } from '@/application/scripts/GetScript'
import { ListScripts } from '@/application/scripts/ListScripts'
import { MergeCards } from '@/application/scripts/MergeCards'
import { ReorderCards } from '@/application/scripts/ReorderCards'
import { SaveScriptAggregate } from '@/application/scripts/SaveScriptAggregate'
import { SplitCard } from '@/application/scripts/SplitCard'
import { UpdateCard } from '@/application/scripts/UpdateCard'
import { UpdateCues } from '@/application/scripts/UpdateCues'
import {
  editorDependenciesKey,
  type EditorDependencies,
} from '@/features/editor/editor.dependencies'
import {
  importNavigationKey,
  importWorkflowKey,
} from '@/features/import/import.dependencies'
import {
  libraryDependenciesKey,
  libraryNavigationKey,
  type LibraryDependencies,
} from '@/features/library/library.dependencies'
import {
  recordingDependenciesKey,
  type RecordingDependencies,
} from '@/features/recording/recording.dependencies'
import { CapacitorSourceFilePicker } from '@/infrastructure/capacitor/CapacitorSourceFilePicker'
import {
  registerAppBackgroundListener,
  registerAppStateListener,
} from '@/infrastructure/capacitor/CapacitorAppBackground'
import { CapacitorWakeLock } from '@/infrastructure/capacitor/CapacitorWakeLock'
import { CapacitorSqlDriver } from '@/infrastructure/sqlite/CapacitorSqlDriver'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'
import { SqliteOutboxRepository } from '@/infrastructure/sqlite/SqliteOutboxRepository'
import { SqliteRecordingSessionRepository } from '@/infrastructure/sqlite/SqliteRecordingSessionRepository'
import { SqliteScriptRepository } from '@/infrastructure/sqlite/SqliteScriptRepository'

export async function bootstrapApp(): Promise<void> {
  const appRouter = createAppRouter()
  let importWorkflow: ImportWorkflow | null = null
  let libraryDependencies: LibraryDependencies | null = null
  let editorDependencies: EditorDependencies | null = null
  let recordingDependencies: RecordingDependencies | null = null

  if (Capacitor.isNativePlatform()) {
    const database = new CapacitorSqlDriver()
    await database.initialize()
    const scripts = new SqliteScriptRepository(database)
    const outbox = new SqliteOutboxRepository(database)
    const sessions = new SqliteRecordingSessionRepository(database)
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
    const clock = { now: () => new Date().toISOString() }
    editorDependencies = {
      getScript: new GetScript(scripts, saveAggregate),
      updateCard: new UpdateCard(scripts, saveAggregate, clock),
      reorderCards: new ReorderCards(scripts, saveAggregate, clock),
      splitCard: new SplitCard(scripts, saveAggregate, clock),
      mergeCards: new MergeCards(scripts, saveAggregate, clock),
      updateCues: new UpdateCues(scripts, saveAggregate, clock),
      onAppBackground: registerAppBackgroundListener,
    }
    const wakeLock = new CapacitorWakeLock()
    recordingDependencies = {
      loadScript: new GetScript(scripts, saveAggregate),
      loadSession: async (scriptId) => sessions.get(scriptId),
      startRecording: new StartRecording(scripts, sessions, wakeLock, clock),
      moveRecordingCursor: new MoveRecordingCursor(scripts, sessions, wakeLock, clock),
      updateRecordingDisplay: new UpdateRecordingDisplay(sessions, clock),
      finishRecording: new FinishRecording(sessions, wakeLock),
      wakeLock,
      onAppStateChange: registerAppStateListener,
      openLibrary: async () => { await appRouter.push('/library') },
    }
  }

  const app = createApp(App)

  app.use(createPinia())
  app.use(appRouter)
  if (importWorkflow !== null) app.provide(importWorkflowKey, importWorkflow)
  if (libraryDependencies !== null) {
    app.provide(libraryDependenciesKey, libraryDependencies)
  }
  if (editorDependencies !== null) app.provide(editorDependenciesKey, editorDependencies)
  if (recordingDependencies !== null) {
    app.provide(recordingDependenciesKey, recordingDependencies)
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
