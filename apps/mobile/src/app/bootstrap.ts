import { Capacitor } from '@capacitor/core'
import { createPinia } from 'pinia'
import { v7 as uuidv7 } from 'uuid'
import { createApp } from 'vue'

import App from '@/App.vue'
import { createAuthGuard } from '@/app/authGuard'
import { createAppRouter } from '@/app/router'
import { Login } from '@/application/auth/Login'
import { Logout } from '@/application/auth/Logout'
import { RefreshGeneration } from '@/application/ai/RefreshGeneration'
import { ResumeAiGenerations } from '@/application/ai/ResumeAiGenerations'
import { StartCardCueGeneration } from '@/application/ai/StartCardCueGeneration'
import { StartScriptCueGeneration } from '@/application/ai/StartScriptCueGeneration'
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
import { ApplyRemoteChanges } from '@/application/sync/ApplyRemoteChanges'
import { RecordSyncConflict } from '@/application/sync/RecordSyncConflict'
import { ResolveConflict } from '@/application/sync/ResolveConflict'
import { RunSync } from '@/application/sync/RunSync'
import {
  authDependenciesKey,
  authNavigationKey,
} from '@/features/auth/auth.dependencies'
import {
  aiCuesDependenciesKey,
  type AiCuesDependencies,
} from '@/features/ai-cues/aiCues.dependencies'
import { useAuthStore } from '@/features/auth/auth.store'
import { useAiCuesStore } from '@/features/ai-cues/aiCues.store'
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
import {
  syncDependenciesKey,
  syncNavigationKey,
  type SyncDependencies,
} from '@/features/sync/sync.dependencies'
import { useSyncStore } from '@/features/sync/sync.store'
import { HttpSyncGateway } from '@/infrastructure/api/HttpSyncGateway'
import { HttpAiGenerationGateway } from '@/infrastructure/api/HttpAiGenerationGateway'
import { CapacitorConnectivity } from '@/infrastructure/capacitor/CapacitorConnectivity'
import { CapacitorSourceFilePicker } from '@/infrastructure/capacitor/CapacitorSourceFilePicker'
import { SecureTokenStore } from '@/infrastructure/capacitor/SecureTokenStore'
import {
  registerAppBackgroundListener,
  registerAppStateListener,
} from '@/infrastructure/capacitor/CapacitorAppBackground'
import { CapacitorWakeLock } from '@/infrastructure/capacitor/CapacitorWakeLock'
import { ApiClient } from '@/infrastructure/api/ApiClient'
import { CapacitorSqlDriver } from '@/infrastructure/sqlite/CapacitorSqlDriver'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'
import { SqliteOutboxRepository } from '@/infrastructure/sqlite/SqliteOutboxRepository'
import { SqliteConflictRepository } from '@/infrastructure/sqlite/SqliteConflictRepository'
import { SqliteAiGenerationRequestRepository } from '@/infrastructure/sqlite/SqliteAiGenerationRequestRepository'
import { SqliteRecordingSessionRepository } from '@/infrastructure/sqlite/SqliteRecordingSessionRepository'
import { SqliteScriptRepository } from '@/infrastructure/sqlite/SqliteScriptRepository'
import { SqliteSyncStateRepository } from '@/infrastructure/sqlite/SqliteSyncStateRepository'
import { BrowserOutboxRepository } from '@/infrastructure/memory/BrowserOutboxRepository'
import { BrowserScriptRepository } from '@/infrastructure/memory/BrowserScriptRepository'
import { MemorySqlDriver } from '@/infrastructure/memory/MemorySqlDriver'
import { BrowserSourceFilePicker } from '@/infrastructure/browser/BrowserSourceFilePicker'
import { NoopWakeLock } from '@/infrastructure/browser/NoopWakeLock'
import { BrowserAiCuesDependencies } from '@/infrastructure/browser/BrowserAiCuesDependencies'
import { BrowserRecordingSessionRepository } from '@/infrastructure/memory/BrowserRecordingSessionRepository'
import { BrowserConflictRepository } from '@/infrastructure/memory/BrowserConflictRepository'
import { BrowserSyncStateRepository } from '@/infrastructure/memory/BrowserSyncStateRepository'
import { BrowserConnectivity } from '@/infrastructure/browser/BrowserConnectivity'

export async function bootstrapApp(): Promise<void> {
  const pinia = createPinia()
  const tokens = new SecureTokenStore()
  const api = new ApiClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
    tokens,
  })
  const login = new Login(api, tokens)
  const logout = new Logout(api, tokens)
  const authStore = useAuthStore(pinia)
  const appRouter = createAppRouter(createAuthGuard({
    get initialized() { return authStore.initialized },
    get session() { return authStore.session },
    restore: async () => { await authStore.restore(login) },
  }))
  let importWorkflow: ImportWorkflow | null = null
  let libraryDependencies: LibraryDependencies | null = null
  let editorDependencies: EditorDependencies | null = null
  let recordingDependencies: RecordingDependencies | null = null
  let syncDependencies: SyncDependencies | null = null
  let aiCuesDependencies: AiCuesDependencies | null = null
  let resumeAiGenerations: ResumeAiGenerations | null = null
  let runSync: RunSync | null = null
  const syncStore = useSyncStore(pinia)
  const aiCuesStore = useAiCuesStore(pinia)

  if (Capacitor.isNativePlatform()) {
    const database = new CapacitorSqlDriver()
    await database.initialize()
    const scripts = new SqliteScriptRepository(database)
    const outbox = new SqliteOutboxRepository(database)
    const conflicts = new SqliteConflictRepository(database)
    const syncState = new SqliteSyncStateRepository(database)
    const unitOfWork = new LocalUnitOfWork(database)
    const sessions = new SqliteRecordingSessionRepository(database)
    const aiRequests = new SqliteAiGenerationRequestRepository(database)
    const clock = { now: () => new Date().toISOString() }
    const saveAggregate = new SaveScriptAggregate(
      scripts,
      outbox,
      unitOfWork,
      clock,
      uuidv7,
      () => {
        if (runSync !== null) void syncStore.run(runSync, 'connectivity')
      },
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
    const connectivity = new CapacitorConnectivity()
    const gateway = new HttpSyncGateway(api)
    const applyRemoteChanges = new ApplyRemoteChanges(scripts, outbox, syncState, unitOfWork)
    const recordConflict = new RecordSyncConflict(
      conflicts,
      scripts,
      unitOfWork,
      uuidv7,
      clock,
    )
    runSync = new RunSync(
      connectivity,
      gateway,
      scripts,
      outbox,
      syncState,
      applyRemoteChanges,
      recordConflict,
    )
    const activeRunSync = runSync
    const aiGateway = new HttpAiGenerationGateway(api)
    const startScriptGeneration = new StartScriptCueGeneration(
      scripts,
      saveAggregate,
      connectivity,
      activeRunSync,
      aiGateway,
      aiRequests,
    )
    const startCardGeneration = new StartCardCueGeneration(
      scripts,
      saveAggregate,
      connectivity,
      activeRunSync,
      aiGateway,
      aiRequests,
    )
    const refreshGeneration = new RefreshGeneration(aiGateway, activeRunSync, aiRequests)
    resumeAiGenerations = new ResumeAiGenerations(
      aiRequests,
      startScriptGeneration,
      startCardGeneration,
      refreshGeneration,
      {
        accepted: (scopeKey, result) => { aiCuesStore.acceptResumed(scopeKey, result) },
        updated: (scopeKey, generation) => { aiCuesStore.updateResumed(scopeKey, generation) },
        failed: (scopeKey, error) => { aiCuesStore.failResumed(scopeKey, error) },
      },
    )
    const activeResumeAiGenerations = resumeAiGenerations
    aiCuesDependencies = {
      startScript: startScriptGeneration,
      startCard: startCardGeneration,
      refresh: refreshGeneration,
    }
    syncDependencies = {
      conflicts,
      resolveConflict: new ResolveConflict(
        scripts,
        outbox,
        conflicts,
        unitOfWork,
        uuidv7,
        clock,
      ),
      runSync: activeRunSync,
    }
    const syncAndResume = async (reason: 'startup' | 'connectivity'): Promise<void> => {
      await syncStore.run(activeRunSync, reason)
      if (syncStore.state === 'up-to-date') await activeResumeAiGenerations.execute()
    }
    connectivity.subscribe((online) => {
      if (!online) {
        syncStore.state = 'offline'
        return
      }
      void syncAndResume('connectivity')
    })
    registerAppStateListener((isActive) => {
      if (isActive) void syncAndResume('connectivity')
    })
    void syncAndResume('startup')
  } else if (import.meta.env.VITE_E2E_MODE === 'true') {
    const scripts = new BrowserScriptRepository()
    const outbox = new BrowserOutboxRepository(scripts)
    const unitOfWork = new LocalUnitOfWork(new MemorySqlDriver())
    const clock = { now: () => new Date().toISOString() }
    const saveAggregate = new SaveScriptAggregate(
      scripts,
      outbox,
      unitOfWork,
      clock,
      uuidv7,
      () => {
        if (runSync !== null) void syncStore.run(runSync, 'connectivity')
      },
    )
    const saveDraft = new SaveImportDraft(saveAggregate, uuidv7, clock)
    const sessions = new BrowserRecordingSessionRepository()
    const conflicts = new BrowserConflictRepository()
    importWorkflow = new ImportWorkflow(
      new BrowserSourceFilePicker(),
      new ParseSourceDocument(),
      saveDraft,
    )
    libraryDependencies = {
      listScripts: new ListScripts(scripts),
      getScript: new GetScript(scripts, saveAggregate),
      deleteScript: new DeleteScript(scripts, saveAggregate),
      isOnline: () => navigator.onLine,
    }
    editorDependencies = {
      getScript: new GetScript(scripts, saveAggregate),
      updateCard: new UpdateCard(scripts, saveAggregate, clock),
      reorderCards: new ReorderCards(scripts, saveAggregate, clock),
      splitCard: new SplitCard(scripts, saveAggregate, clock),
      mergeCards: new MergeCards(scripts, saveAggregate, clock),
      updateCues: new UpdateCues(scripts, saveAggregate, clock),
      onAppBackground: () => () => undefined,
    }
    const wakeLock = new NoopWakeLock()
    recordingDependencies = {
      loadScript: new GetScript(scripts, saveAggregate),
      loadSession: async (scriptId) => sessions.get(scriptId),
      startRecording: new StartRecording(scripts, sessions, wakeLock, clock),
      moveRecordingCursor: new MoveRecordingCursor(scripts, sessions, wakeLock, clock),
      updateRecordingDisplay: new UpdateRecordingDisplay(sessions, clock),
      finishRecording: new FinishRecording(sessions, wakeLock),
      wakeLock,
      onAppStateChange: () => () => undefined,
      openLibrary: async () => { await appRouter.push('/library') },
    }
    aiCuesDependencies = new BrowserAiCuesDependencies(scripts, saveAggregate, clock.now, uuidv7)
    const connectivity = new BrowserConnectivity()
    const syncState = new BrowserSyncStateRepository()
    const gateway = new HttpSyncGateway(api)
    const applyRemoteChanges = new ApplyRemoteChanges(scripts, outbox, syncState, unitOfWork)
    const recordConflict = new RecordSyncConflict(conflicts, scripts, unitOfWork, uuidv7, clock)
    runSync = new RunSync(
      connectivity,
      gateway,
      scripts,
      outbox,
      syncState,
      applyRemoteChanges,
      recordConflict,
    )
    syncDependencies = {
      conflicts,
      resolveConflict: new ResolveConflict(scripts, outbox, conflicts, unitOfWork, uuidv7, clock),
      runSync,
    }
    const activeRunSync = runSync
    connectivity.subscribe((online) => {
      if (!online) {
        syncStore.state = 'offline'
        return
      }
      void syncStore.run(activeRunSync, 'connectivity')
    })
  }

  const app = createApp(App)

  app.use(pinia)
  app.use(appRouter)
  app.provide(authDependenciesKey, {
    login,
    logout,
    afterAuthenticated: async () => {
      if (runSync !== null) {
        await syncStore.run(runSync, 'manual')
        if (syncStore.state === 'up-to-date') await resumeAiGenerations?.execute()
      }
    },
  })
  app.provide(authNavigationKey, {
    openLibrary: async () => { await appRouter.push('/library') },
  })
  if (importWorkflow !== null) app.provide(importWorkflowKey, importWorkflow)
  if (libraryDependencies !== null) {
    app.provide(libraryDependenciesKey, libraryDependencies)
  }
  if (editorDependencies !== null) app.provide(editorDependenciesKey, editorDependencies)
  if (recordingDependencies !== null) {
    app.provide(recordingDependenciesKey, recordingDependencies)
  }
  if (syncDependencies !== null) app.provide(syncDependenciesKey, syncDependencies)
  if (aiCuesDependencies !== null) app.provide(aiCuesDependenciesKey, aiCuesDependencies)
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
  app.provide(syncNavigationKey, {
    openLibrary: async (focusIds) => {
      await appRouter.push({ path: '/library', query: { focus: [...focusIds].join(',') } })
    },
    openConflict: async (conflictId) => { await appRouter.push(`/sync/conflicts/${conflictId}`) },
    openLogin: async () => { await appRouter.push('/login') },
  })

  await appRouter.isReady()
  app.mount('#app')
}
