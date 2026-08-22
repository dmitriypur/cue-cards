import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Connectivity } from '@/application/ports/Connectivity'
import { ApiError } from '@/application/ports/ApiClient'
import type {
  SyncBatchResponse,
  SyncGateway,
  SyncPage,
} from '@/application/ports/SyncGateway'
import { ApplyRemoteChanges } from '@/application/sync/ApplyRemoteChanges'
import { RecordSyncConflict } from '@/application/sync/RecordSyncConflict'
import { RunSync } from '@/application/sync/RunSync'
import { StartRecording } from '@/application/recording/StartRecording'
import { SaveScriptAggregate } from '@/application/scripts/SaveScriptAggregate'
import type { ScriptAggregate } from '@/domain/scripts/types'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'
import { migrateInitialSchema } from '@/infrastructure/sqlite/migrations/001_initial'
import { migrateSyncConflicts } from '@/infrastructure/sqlite/migrations/002_sync_conflicts'
import { SqliteConflictRepository } from '@/infrastructure/sqlite/SqliteConflictRepository'
import { SqliteOutboxRepository } from '@/infrastructure/sqlite/SqliteOutboxRepository'
import { SqliteRecordingSessionRepository } from '@/infrastructure/sqlite/SqliteRecordingSessionRepository'
import { SqliteScriptRepository } from '@/infrastructure/sqlite/SqliteScriptRepository'
import { SqliteSyncStateRepository } from '@/infrastructure/sqlite/SqliteSyncStateRepository'
import { InMemorySqlDriver } from '../../helpers/InMemorySqlDriver'

const scriptId = '019b9ccb-3f71-7000-8000-000000000210'
const operationIds = [
  '019b9ccb-3f71-7000-8000-000000000291',
  '019b9ccb-3f71-7000-8000-000000000292',
]

function aggregate(id: string, title: string, updatedAt: string): ScriptAggregate {
  const cardId = `${id.slice(0, -1)}1`
  return {
    id,
    title,
    sourceFormat: 'markdown',
    sourceText: `# ${title}`,
    importHash: `hash-${id}`,
    serverVersion: 0,
    syncStatus: 'pending',
    cards: [{
      id: cardId,
      scriptId: id,
      position: 0,
      title: 'Блок',
      fullText: 'Синтетический полный текст.',
      contentHash: `content-${id}`,
      version: 0,
      cueSet: {
        id: `${id.slice(0, -1)}2`,
        cardId,
        cues: [],
        sourceHash: null,
        status: 'missing',
        generationId: null,
        manuallyEdited: false,
        version: 0,
        createdAt: updatedAt,
        updatedAt,
      },
      createdAt: updatedAt,
      updatedAt,
      deletedAt: null,
    }],
    lastOpenedAt: null,
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
  }
}

class FixedConnectivity implements Connectivity {
  public constructor(private readonly online: boolean) {}
  public current(): Promise<boolean> { return Promise.resolve(this.online) }
  public subscribe(): () => void { return () => undefined }
}

class FakeGateway implements SyncGateway {
  public readonly submitted: string[] = []
  public readonly submittedCommands: Parameters<SyncGateway['submit']>[0][] = []
  public changesAfter: number[] = []
  public rejectSubmit = false
  public submitError: Error | null = null
  public page: SyncPage = { changes: [], nextCursor: 0, hasMore: false }
  public beforeSubmit: (() => Promise<void>) | null = null
  public beforeChanges: (() => Promise<void>) | null = null
  public changesError: Error | null = null
  public changesFailures = 0
  public duplicateResponse = false

  public async submit(commands: Parameters<SyncGateway['submit']>[0]): Promise<SyncBatchResponse> {
    this.submitted.push(...commands.map(({ operationId }) => operationId))
    this.submittedCommands.push(commands)
    await this.beforeSubmit?.()
    if (this.submitError !== null) throw this.submitError
    if (this.rejectSubmit) throw new Error('server unavailable')
    return {
      results: commands.map((command, index) => ({
        operationId: command.operationId,
        aggregateId: command.aggregateId,
        version: index + 1,
        duplicate: this.duplicateResponse,
      })),
    }
  }

  public async changes(after: number): Promise<SyncPage> {
    this.changesAfter.push(after)
    await this.beforeChanges?.()
    if (this.changesFailures > 0) {
      this.changesFailures -= 1
      throw new Error('transient change feed failure')
    }
    if (this.changesError !== null) throw this.changesError
    return this.page
  }
}

describe('RunSync', () => {
  let driver: InMemorySqlDriver
  let scripts: SqliteScriptRepository
  let outbox: SqliteOutboxRepository
  let syncState: SqliteSyncStateRepository
  let conflicts: SqliteConflictRepository

  beforeEach(async () => {
    driver = new InMemorySqlDriver()
    await migrateInitialSchema(driver)
    await migrateSyncConflicts(driver)
    scripts = new SqliteScriptRepository(driver)
    outbox = new SqliteOutboxRepository(driver)
    syncState = new SqliteSyncStateRepository(driver)
    conflicts = new SqliteConflictRepository(driver)
  })

  afterEach(() => driver.close())

  async function save(value: ScriptAggregate, operationId: string): Promise<void> {
    await new SaveScriptAggregate(
      scripts,
      outbox,
      new LocalUnitOfWork(driver),
      { now: () => value.updatedAt },
      () => operationId,
    ).execute({ aggregate: value })
  }

  function action(
    connectivity: Connectivity,
    gateway: SyncGateway,
    timing?: {
      readonly now: () => Date
      readonly jitter: () => number
      readonly schedule: (work: () => void, delayMs: number) => unknown
      readonly cancelSchedule?: (handle: unknown) => void
    },
  ): RunSync {
    return new RunSync(
      connectivity,
      gateway,
      scripts,
      outbox,
      syncState,
      new ApplyRemoteChanges(scripts, outbox, syncState, new LocalUnitOfWork(driver)),
      new RecordSyncConflict(
        conflicts,
        scripts,
        new LocalUnitOfWork(driver),
        () => '019b9ccb-3f71-7000-8000-000000000299',
        { now: () => '2026-08-07T07:09:00.000Z' },
      ),
      timing?.now,
      timing?.jitter,
      timing?.schedule,
      timing?.cancelSchedule,
    )
  }

  it('does not contact the server while offline', async () => {
    await save(aggregate(scriptId, 'Офлайн', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    const gateway = new FakeGateway()

    const result = await action(new FixedConnectivity(false), gateway).execute('manual')

    expect(result.state).toBe('offline')
    expect(gateway.submitted).toEqual([])
    expect(gateway.changesAfter).toEqual([])
    await expect(outbox.next()).resolves.toMatchObject({ operationId: operationIds[0] })
  })

  it('downloads adaptive cues and keeps them available for recording after an offline restart', async () => {
    const local = aggregate(scriptId, 'Лесная запись', '2026-08-07T07:00:00.000Z')
    await scripts.save({ ...local, serverVersion: 1, syncStatus: 'synced' })
    const remoteCues = [
      'Объяснить, почему внимание быстро рассеивается.',
      'Назвать главный внешний отвлекающий фактор.',
      'Показать внутреннюю причину потери фокуса.',
      'Привести короткий пример из повседневной работы.',
      'Дать первый практический шаг для возвращения внимания.',
      'Связать этот шаг со следующим блоком сценария.',
    ]
    const remote: ScriptAggregate = {
      ...local,
      serverVersion: 2,
      syncStatus: 'synced',
      cards: local.cards.map((card) => ({
        ...card,
        cueSet: {
          ...card.cueSet,
          cues: remoteCues,
          sourceHash: card.contentHash,
          status: 'ready',
          generationId: '019b9ccb-3f71-7000-8000-000000000298',
          version: 1,
        },
      })),
    }
    const gateway = new FakeGateway()
    gateway.page = {
      changes: [{
        cursor: 2,
        aggregateId: scriptId,
        version: 2,
        type: 'script.replace',
        snapshot: remote,
      }],
      nextCursor: 2,
      hasMore: false,
    }

    await expect(action(new FixedConnectivity(true), gateway).execute('startup')).resolves.toEqual({
      state: 'up-to-date',
      uploaded: 0,
      downloaded: 1,
    })

    const restartedScripts = new SqliteScriptRepository(driver)
    const restartedOutbox = new SqliteOutboxRepository(driver)
    const restartedState = new SqliteSyncStateRepository(driver)
    const restartedConflicts = new SqliteConflictRepository(driver)
    const forbiddenGateway = new FakeGateway()
    const offlineSync = new RunSync(
      new FixedConnectivity(false),
      forbiddenGateway,
      restartedScripts,
      restartedOutbox,
      restartedState,
      new ApplyRemoteChanges(
        restartedScripts,
        restartedOutbox,
        restartedState,
        new LocalUnitOfWork(driver),
      ),
      new RecordSyncConflict(
        restartedConflicts,
        restartedScripts,
        new LocalUnitOfWork(driver),
        () => '019b9ccb-3f71-7000-8000-000000000299',
        { now: () => '2026-08-07T07:09:00.000Z' },
      ),
    )

    await expect(offlineSync.execute('startup')).resolves.toMatchObject({ state: 'offline' })
    expect(forbiddenGateway.submitted).toEqual([])
    expect(forbiddenGateway.changesAfter).toEqual([])
    await expect(restartedScripts.get(scriptId)).resolves.toMatchObject({
      sourceText: '# Лесная запись',
      cards: [{ fullText: 'Синтетический полный текст.', cueSet: { cues: remoteCues } }],
    })
    await expect(restartedScripts.list()).resolves.toEqual([
      expect.objectContaining({ cardCount: 1, offlineReadyCardCount: 1 }),
    ])

    const sessions = new SqliteRecordingSessionRepository(driver)
    const wakeLock = { acquire: () => Promise.resolve(), release: () => Promise.resolve() }
    await new StartRecording(
      restartedScripts,
      sessions,
      wakeLock,
      { now: () => '2026-08-07T07:10:00.000Z' },
    ).execute({
      scriptId,
      cardId: remote.cards[0]!.id,
      mode: 'cues',
      fontScale: 1,
    })
    await expect(sessions.get(scriptId)).resolves.toMatchObject({ mode: 'cues' })
  })

  it('uploads commands FIFO and acknowledges each only after server acceptance', async () => {
    const secondId = '019b9ccb-3f71-7000-8000-000000000220'
    await save(aggregate(scriptId, 'Первый', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    await save(aggregate(secondId, 'Второй', '2026-08-07T07:01:00.000Z'), operationIds[1]!)
    const gateway = new FakeGateway()

    const result = await action(new FixedConnectivity(true), gateway).execute('manual')

    expect(result.state).toBe('up-to-date')
    expect(gateway.submitted).toEqual(operationIds)
    await expect(outbox.next()).resolves.toBeNull()
    await expect(scripts.get(scriptId)).resolves.toMatchObject({ serverVersion: 1, syncStatus: 'synced' })
    await expect(scripts.get(secondId)).resolves.toMatchObject({ serverVersion: 1, syncStatus: 'synced' })
  })

  it('acknowledges an idempotent duplicate operation without a second local write', async () => {
    await save(aggregate(scriptId, 'Идемпотентный повтор', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    const gateway = new FakeGateway()
    gateway.duplicateResponse = true

    const result = await action(new FixedConnectivity(true), gateway).execute('startup')

    expect(result.uploaded).toBe(1)
    await expect(outbox.find(operationIds[0]!)).resolves.toBeNull()
    await expect(scripts.get(scriptId)).resolves.toMatchObject({ serverVersion: 1, syncStatus: 'synced' })
  })

  it('coalesces offline saves and rebases one in-flight successor before upload', async () => {
    for (let index = 0; index < 5; index += 1) {
      await save(
        aggregate(scriptId, `Офлайн ${index + 1}`, `2026-08-07T07:0${index}:00.000Z`),
        `019b9ccb-3f71-7000-8000-00000000028${index}`,
      )
    }
    const pending = await outbox.next()
    expect(pending).toMatchObject({
      operationId: '019b9ccb-3f71-7000-8000-000000000280',
      payload: { title: 'Офлайн 5' },
    })
    const gateway = new FakeGateway()
    let savedSuccessor = false
    gateway.beforeSubmit = async () => {
      if (savedSuccessor) return
      savedSuccessor = true
      await save(
        aggregate(scriptId, 'Шестая версия', '2026-08-07T07:05:00.000Z'),
        operationIds[1]!,
      )
    }

    await action(new FixedConnectivity(true), gateway).execute('connectivity')

    expect(gateway.submittedCommands).toHaveLength(2)
    expect(gateway.submittedCommands[1]?.[0]).toMatchObject({
      operationId: operationIds[1],
      baseVersion: 1,
      payload: { title: 'Шестая версия' },
    })
    await expect(outbox.next()).resolves.toBeNull()
    await expect(scripts.get(scriptId)).resolves.toMatchObject({ serverVersion: 1, syncStatus: 'synced' })
  })

  it('keeps an unaccepted command for a later idempotent retry', async () => {
    await save(aggregate(scriptId, 'Повтор', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    const gateway = new FakeGateway()
    gateway.rejectSubmit = true

    const result = await action(new FixedConnectivity(true), gateway).execute('manual')

    expect(result.state).toBe('retrying')
    await expect(outbox.find(operationIds[0]!)).resolves.toMatchObject({
      operationId: operationIds[0],
      state: 'pending',
      attempts: 1,
    })
  })

  it('persists the first bounded retry delay and schedules it automatically', async () => {
    await save(aggregate(scriptId, 'Повтор', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    const gateway = new FakeGateway()
    gateway.rejectSubmit = true
    const delays: number[] = []

    await action(new FixedConnectivity(true), gateway, {
      now: () => new Date('2026-08-07T07:10:00.000Z'),
      jitter: () => 0.5,
      schedule: (_work, delayMs) => { delays.push(delayMs) },
    }).execute('connectivity')

    await expect(outbox.find(operationIds[0]!)).resolves.toMatchObject({
      nextAttemptAt: '2026-08-07T07:10:02.000Z',
    })
    expect(delays).toEqual([2_000])
  })

  it('lets a manual run bypass a persisted future retry delay', async () => {
    await save(aggregate(scriptId, 'Повтор сейчас', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    const failingGateway = new FakeGateway()
    failingGateway.rejectSubmit = true
    await action(new FixedConnectivity(true), failingGateway, {
      now: () => new Date('2099-08-07T07:10:00.000Z'),
      jitter: () => 0.5,
      schedule: () => undefined,
    }).execute('connectivity')
    const retrying = await outbox.find(operationIds[0]!)
    expect(retrying?.nextAttemptAt).toBe('2099-08-07T07:10:02.000Z')
    const recoveredGateway = new FakeGateway()

    const result = await action(new FixedConnectivity(true), recoveredGateway, {
      now: () => new Date('2099-08-07T07:10:01.000Z'),
      jitter: () => 0.5,
      schedule: () => undefined,
    }).execute('manual')

    expect(result.state).toBe('up-to-date')
    expect(recoveredGateway.submitted).toEqual([operationIds[0]])
    await expect(outbox.find(operationIds[0]!)).resolves.toBeNull()
  })

  it('restores a persisted retry timer on startup and does not report current', async () => {
    await save(aggregate(scriptId, 'Повтор после запуска', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    await outbox.scheduleRetry(operationIds[0]!, '2099-08-07T07:10:02.000Z')
    const delays: number[] = []
    const gateway = new FakeGateway()

    const result = await action(new FixedConnectivity(true), gateway, {
      now: () => new Date('2099-08-07T07:10:01.000Z'),
      jitter: () => 0.5,
      schedule: (_work, delayMs) => { delays.push(delayMs) },
    }).execute('startup')

    expect(result.state).toBe('retrying')
    expect(gateway.submitted).toEqual([])
    expect(delays).toEqual([1_000])
    await expect(outbox.find(operationIds[0]!)).resolves.toMatchObject({ state: 'pending' })
  })

  it('does not let a later aggregate overtake the deferred FIFO head', async () => {
    const secondId = '019b9ccb-3f71-7000-8000-000000000220'
    await save(aggregate(scriptId, 'Первый отложен', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    await save(aggregate(secondId, 'Второй готов', '2026-08-07T07:01:00.000Z'), operationIds[1]!)
    await outbox.scheduleRetry(operationIds[0]!, '2099-08-07T07:10:02.000Z')
    const gateway = new FakeGateway()

    const result = await action(new FixedConnectivity(true), gateway, {
      now: () => new Date('2099-08-07T07:10:01.000Z'),
      jitter: () => 0.5,
      schedule: () => undefined,
    }).execute('startup')

    expect(result.state).toBe('retrying')
    expect(gateway.submitted).toEqual([])
    await expect(outbox.find(operationIds[1]!)).resolves.toMatchObject({ state: 'pending' })
  })

  it('deduplicates the same persisted retry timer across repeated lifecycle triggers', async () => {
    await save(aggregate(scriptId, 'Один таймер', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    await outbox.scheduleRetry(operationIds[0]!, '2099-08-07T07:10:02.000Z')
    const delays: number[] = []
    const runSync = action(new FixedConnectivity(true), new FakeGateway(), {
      now: () => new Date('2099-08-07T07:10:01.000Z'),
      jitter: () => 0.5,
      schedule: (_work, delayMs) => { delays.push(delayMs) },
    })

    await runSync.execute('startup')
    await runSync.execute('connectivity')

    expect(delays).toEqual([1_000])
  })

  it('cancels an obsolete retry timer after a later connectivity run succeeds', async () => {
    await save(aggregate(scriptId, 'Первый сбой', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    const gateway = new FakeGateway()
    gateway.rejectSubmit = true
    const cancelled: unknown[] = []
    const runSync = action(new FixedConnectivity(true), gateway, {
      now: () => new Date('2099-08-07T07:10:00.000Z'),
      jitter: () => 0.5,
      schedule: () => 'retry-handle',
      cancelSchedule: (handle) => { cancelled.push(handle) },
    })
    await runSync.execute('connectivity')
    gateway.rejectSubmit = false
    await save(aggregate(scriptId, 'Новая готовая версия', '2026-08-07T07:01:00.000Z'), operationIds[1]!)

    await expect(runSync.execute('connectivity')).resolves.toMatchObject({ state: 'up-to-date' })

    expect(cancelled).toEqual(['retry-handle'])
  })

  it('retries a persisted in-flight operation after an app restart', async () => {
    await save(aggregate(scriptId, 'После перезапуска', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    await outbox.markInFlight(operationIds[0]!)
    const gateway = new FakeGateway()

    const result = await action(new FixedConnectivity(true), gateway).execute('startup')

    expect(result.state).toBe('up-to-date')
    expect(gateway.submitted).toEqual([operationIds[0]])
    await expect(outbox.find(operationIds[0]!)).resolves.toBeNull()
  })

  it('stops with auth-required and keeps the command when the token expired', async () => {
    await save(aggregate(scriptId, 'Нужен вход', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    const gateway = new FakeGateway()
    gateway.submitError = new ApiError(401, 'AUTH_UNAUTHENTICATED', 'Требуется вход.', 'correlation')

    const result = await action(new FixedConnectivity(true), gateway).execute('startup')

    expect(result.state).toBe('auth-required')
    await expect(outbox.find(operationIds[0]!)).resolves.toMatchObject({ state: 'pending' })
    expect(gateway.changesAfter).toEqual([])
  })

  it('persists both snapshots and stops automatic work on a version conflict', async () => {
    const local = aggregate(scriptId, 'Локальная версия', '2026-08-07T07:00:00.000Z')
    const server = { ...local, title: 'Серверная версия', serverVersion: 3 }
    await save(local, operationIds[0]!)
    const gateway = new FakeGateway()
    gateway.submitError = new (await import('@/application/ports/SyncGateway')).SyncConflictError(
      scriptId,
      local,
      server,
    )

    const result = await action(new FixedConnectivity(true), gateway).execute('manual')

    expect(result.state).toBe('conflict')
    await expect(conflicts.list()).resolves.toEqual([expect.objectContaining({
      aggregateId: scriptId,
      operationId: operationIds[0],
      local: expect.objectContaining({ title: 'Локальная версия' }),
      server: expect.objectContaining({ title: 'Серверная версия' }),
    })])
    await expect(scripts.get(scriptId)).resolves.toMatchObject({ syncStatus: 'conflict' })
    expect(gateway.changesAfter).toEqual([])
  })

  it('preserves the newest local successor when an older in-flight snapshot conflicts', async () => {
    const submitted = aggregate(scriptId, 'Отправленная версия', '2026-08-07T07:00:00.000Z')
    const newest = aggregate(scriptId, 'Новая локальная версия', '2026-08-07T07:01:00.000Z')
    const server = { ...submitted, title: 'Серверная версия', serverVersion: 3 }
    await save(submitted, operationIds[0]!)
    const gateway = new FakeGateway()
    gateway.beforeSubmit = async () => {
      await save(newest, operationIds[1]!)
    }
    gateway.submitError = new (await import('@/application/ports/SyncGateway')).SyncConflictError(
      scriptId,
      submitted,
      server,
    )

    await expect(action(new FixedConnectivity(true), gateway).execute('manual')).resolves.toMatchObject({
      state: 'conflict',
    })

    await expect(conflicts.list()).resolves.toEqual([expect.objectContaining({
      aggregateId: scriptId,
      operationId: operationIds[0],
      local: expect.objectContaining({ title: 'Новая локальная версия' }),
      server: expect.objectContaining({ title: 'Серверная версия' }),
    })])
    await expect(outbox.find(operationIds[1]!)).resolves.toMatchObject({
      payload: expect.objectContaining({ title: 'Новая локальная версия' }),
    })
  })

  it('downloads from the persisted cursor and advances it after the page succeeds', async () => {
    await syncState.setCursor(7)
    const gateway = new FakeGateway()
    gateway.page = { changes: [], nextCursor: 11, hasMore: false }

    await action(new FixedConnectivity(true), gateway).execute('startup')

    expect(gateway.changesAfter).toEqual([7])
    await expect(syncState.cursor()).resolves.toBe(11)
  })

  it('keeps the cursor and schedules a bounded retry when change download fails', async () => {
    await syncState.setCursor(7)
    const gateway = new FakeGateway()
    gateway.changesError = new Error('change feed unavailable')
    const delays: number[] = []

    const result = await action(new FixedConnectivity(true), gateway, {
      now: () => new Date('2026-08-07T07:10:00.000Z'),
      jitter: () => 0.5,
      schedule: (_work, delayMs) => { delays.push(delayMs) },
    }).execute('startup')

    expect(result.state).toBe('retrying')
    await expect(syncState.cursor()).resolves.toBe(7)
    expect(delays).toEqual([2_000])
  })

  it('rolls back remote writes and leaves the cursor unchanged when a page fails', async () => {
    const remote = { ...aggregate(scriptId, 'Не сохранится', '2026-08-07T07:10:00.000Z'), serverVersion: 4 }
    const gateway = new FakeGateway()
    gateway.page = {
      changes: [{ cursor: 4, aggregateId: scriptId, version: 4, type: 'script.replace', snapshot: remote }],
      nextCursor: 4,
      hasMore: false,
    }
    driver.failNextStatementContaining('INSERT INTO cue_sets')

    await expect(action(new FixedConnectivity(true), gateway, {
      now: () => new Date('2026-08-07T07:10:00.000Z'),
      jitter: () => 0.5,
      schedule: () => undefined,
    }).execute('startup')).resolves.toMatchObject({ state: 'retrying' })

    await expect(scripts.get(scriptId)).resolves.toBeNull()
    await expect(syncState.cursor()).resolves.toBe(0)
  })

  it('shares one process-wide run across overlapping triggers', async () => {
    await save(aggregate(scriptId, 'Один запуск', '2026-08-07T07:00:00.000Z'), operationIds[0]!)
    const gateway = new FakeGateway()
    let release = (): void => undefined
    let markEntered = (): void => undefined
    const entered = new Promise<void>((resolve) => { markEntered = resolve })
    gateway.beforeSubmit = () => {
      markEntered()
      return new Promise<void>((resolve) => { release = resolve })
    }
    const runSync = action(new FixedConnectivity(true), gateway)

    const startup = runSync.execute('startup')
    await entered
    const manual = runSync.execute('manual')
    release()

    await expect(Promise.all([startup, manual])).resolves.toEqual([
      { state: 'up-to-date', uploaded: 1, downloaded: 0 },
      { state: 'up-to-date', uploaded: 1, downloaded: 0 },
    ])
    expect(gateway.submitted).toEqual([operationIds[0]])
  })

  it('runs a follow-up pass when a local commit arrives during change download', async () => {
    const gateway = new FakeGateway()
    const runSync = action(new FixedConnectivity(true), gateway)
    let triggered = false
    gateway.beforeChanges = async () => {
      if (triggered) return
      triggered = true
      await save(
        aggregate(scriptId, 'Сохранено во время загрузки', '2026-08-07T07:05:00.000Z'),
        operationIds[0]!,
      )
      void runSync.execute('connectivity')
    }

    const result = await runSync.execute('startup')

    expect(result).toMatchObject({ state: 'up-to-date', uploaded: 1 })
    expect(gateway.submitted).toEqual([operationIds[0]])
    expect(gateway.changesAfter).toEqual([0, 0])
    await expect(outbox.next()).resolves.toBeNull()
  })

  it('keeps a queued connectivity pass after a transient retrying result', async () => {
    const gateway = new FakeGateway()
    gateway.changesFailures = 1
    const runSync = action(new FixedConnectivity(true), gateway, {
      now: () => new Date('2026-08-07T07:10:00.000Z'),
      jitter: () => 0.5,
      schedule: () => undefined,
    })
    let queued = false
    gateway.beforeChanges = async () => {
      if (queued) return
      queued = true
      void runSync.execute('connectivity')
    }

    const result = await runSync.execute('startup')

    expect(result.state).toBe('up-to-date')
    expect(gateway.changesAfter).toEqual([0, 0])
  })

  it('saves a remote aggregate and its cursor in one local transaction', async () => {
    const remote = { ...aggregate(scriptId, 'С сервера', '2026-08-07T07:10:00.000Z'), serverVersion: 4 }
    const gateway = new FakeGateway()
    gateway.page = {
      changes: [{
        cursor: 4,
        aggregateId: scriptId,
        version: 4,
        type: 'script.replace',
        snapshot: remote,
      }],
      nextCursor: 4,
      hasMore: false,
    }

    await action(new FixedConnectivity(true), gateway).execute('startup')

    await expect(scripts.get(scriptId)).resolves.toEqual({
      ...remote,
      syncStatus: 'synced',
    })
    await expect(syncState.cursor()).resolves.toBe(4)
  })

  it('does not replace or silently rebase fresh local text from an older remote AI snapshot', async () => {
    const original = aggregate(scriptId, 'Сценарий', '2026-08-07T07:00:00.000Z')
    await save(original, operationIds[0]!)
    const gateway = new FakeGateway()
    const remoteCard = original.cards[0]!
    gateway.page = {
      changes: [{
        cursor: 2,
        aggregateId: scriptId,
        version: 2,
        type: 'script.replace',
        snapshot: {
          ...original,
          serverVersion: 2,
          cards: [{
            ...remoteCard,
            cueSet: {
              ...remoteCard.cueSet,
              cues: ['Старый тезис один', 'Старый тезис два', 'Старый тезис три'],
              sourceHash: remoteCard.contentHash,
              status: 'ready',
              version: 1,
            },
          }],
        },
      }],
      nextCursor: 2,
      hasMore: false,
    }
    gateway.beforeChanges = async () => {
      const current = await scripts.get(scriptId)
      if (current === null) throw new Error('missing local script')
      const card = current.cards[0]!
      await save({
        ...current,
        syncStatus: 'pending',
        updatedAt: '2026-08-07T07:05:00.000Z',
        cards: [{
          ...card,
          fullText: 'Новый локальный полный текст.',
          contentHash: 'fresh-local-hash',
          cueSet: { ...card.cueSet, status: 'stale' },
        }],
      }, operationIds[1]!)
    }

    await action(new FixedConnectivity(true), gateway).execute('connectivity')

    const saved = await scripts.get(scriptId)
    expect(saved?.cards[0]).toMatchObject({
      fullText: 'Новый локальный полный текст.',
      contentHash: 'fresh-local-hash',
      cueSet: { cues: [], status: 'stale' },
    })
    await expect(outbox.next()).resolves.toMatchObject({
      operationId: operationIds[1],
      baseVersion: 1,
    })
  })
})
