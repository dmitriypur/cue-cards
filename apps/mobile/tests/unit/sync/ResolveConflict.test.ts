import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ResolveConflict } from '@/application/sync/ResolveConflict'
import type { ScriptAggregate } from '@/domain/scripts/types'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'
import { migrateInitialSchema } from '@/infrastructure/sqlite/migrations/001_initial'
import { migrateSyncConflicts } from '@/infrastructure/sqlite/migrations/002_sync_conflicts'
import { SqliteConflictRepository } from '@/infrastructure/sqlite/SqliteConflictRepository'
import { SqliteOutboxRepository } from '@/infrastructure/sqlite/SqliteOutboxRepository'
import { SqliteScriptRepository } from '@/infrastructure/sqlite/SqliteScriptRepository'
import { InMemorySqlDriver } from '../../helpers/InMemorySqlDriver'

const ids = {
  script: '019b9ccb-3f71-7000-8000-000000000310',
  card: '019b9ccb-3f71-7000-8000-000000000311',
  cues: '019b9ccb-3f71-7000-8000-000000000312',
  operation: '019b9ccb-3f71-7000-8000-000000000313',
  conflict: '019b9ccb-3f71-7000-8000-000000000314',
  duplicateScript: '019b9ccb-3f71-7000-8000-000000000320',
  duplicateCard: '019b9ccb-3f71-7000-8000-000000000321',
  duplicateCues: '019b9ccb-3f71-7000-8000-000000000322',
  duplicateOperation: '019b9ccb-3f71-7000-8000-000000000323',
}

function snapshot(title: string, text: string, version: number): ScriptAggregate {
  return {
    id: ids.script,
    title,
    sourceFormat: 'markdown',
    sourceText: `# ${title}\n\n${text}`,
    importHash: 'synthetic-import-hash',
    serverVersion: version,
    syncStatus: 'conflict',
    cards: [{
      id: ids.card,
      scriptId: ids.script,
      position: 0,
      title: 'Блок',
      fullText: text,
      contentHash: `hash-${title}`,
      version,
      cueSet: {
        id: ids.cues,
        cardId: ids.card,
        cues: ['Первый тезис', 'Второй тезис', 'Третий тезис'],
        sourceHash: `hash-${title}`,
        status: 'ready',
        generationId: null,
        manuallyEdited: false,
        version,
        createdAt: '2026-08-07T07:00:00.000Z',
        updatedAt: '2026-08-07T07:05:00.000Z',
      },
      createdAt: '2026-08-07T07:00:00.000Z',
      updatedAt: '2026-08-07T07:05:00.000Z',
      deletedAt: null,
    }],
    lastOpenedAt: null,
    createdAt: '2026-08-07T07:00:00.000Z',
    updatedAt: '2026-08-07T07:05:00.000Z',
    deletedAt: null,
  }
}

describe('ResolveConflict', () => {
  let driver: InMemorySqlDriver
  let scripts: SqliteScriptRepository
  let outbox: SqliteOutboxRepository
  let conflicts: SqliteConflictRepository
  let local: ScriptAggregate
  let server: ScriptAggregate

  beforeEach(async () => {
    driver = new InMemorySqlDriver()
    await migrateInitialSchema(driver)
    await migrateSyncConflicts(driver)
    scripts = new SqliteScriptRepository(driver)
    outbox = new SqliteOutboxRepository(driver)
    conflicts = new SqliteConflictRepository(driver)
    local = snapshot('Локальная версия', 'Локальный полный текст.', 2)
    server = snapshot('Серверная версия', 'Серверный полный текст.', 3)
    await scripts.save(local)
    await outbox.upsertLatestSnapshot({
      operationId: ids.operation,
      aggregateId: ids.script,
      baseVersion: 2,
      type: 'script.replace',
      payload: local,
      createdAt: '2026-08-07T07:06:00.000Z',
    })
    await conflicts.save({
      id: ids.conflict,
      aggregateId: ids.script,
      operationId: ids.operation,
      local,
      server,
      createdAt: '2026-08-07T07:07:00.000Z',
    })
  })

  afterEach(() => driver.close())

  function action(): ResolveConflict {
    const generated = [
      ids.duplicateScript,
      ids.duplicateCard,
      ids.duplicateCues,
      ids.duplicateOperation,
    ]
    return new ResolveConflict(
      scripts,
      outbox,
      conflicts,
      new LocalUnitOfWork(driver),
      () => generated.shift() ?? (() => { throw new Error('unexpected UUID request') })(),
      { now: () => '2026-08-07T07:08:00.000Z' },
    )
  }

  it('accepts the server snapshot and clears the conflicting local command', async () => {
    await action().useServer(ids.conflict)

    await expect(scripts.get(ids.script)).resolves.toEqual({
      ...server,
      syncStatus: 'synced',
    })
    await expect(outbox.find(ids.operation)).resolves.toBeNull()
    await expect(conflicts.get(ids.conflict)).resolves.toBeNull()
  })

  it('duplicates the complete local graph with fresh IDs and keeps the server original', async () => {
    const duplicateId = await action().duplicateLocal(ids.conflict)

    expect(duplicateId).toBe(ids.duplicateScript)
    await expect(scripts.get(ids.script)).resolves.toMatchObject({
      title: 'Серверная версия',
      cards: [{ fullText: 'Серверный полный текст.' }],
      syncStatus: 'synced',
    })
    await expect(scripts.get(ids.duplicateScript)).resolves.toMatchObject({
      id: ids.duplicateScript,
      title: 'Локальная версия (копия)',
      sourceText: local.sourceText,
      serverVersion: 0,
      syncStatus: 'pending',
      cards: [{
        id: ids.duplicateCard,
        scriptId: ids.duplicateScript,
        fullText: 'Локальный полный текст.',
        version: 0,
        cueSet: {
          id: ids.duplicateCues,
          cardId: ids.duplicateCard,
          version: 0,
        },
      }],
    })
    await expect(outbox.next()).resolves.toMatchObject({
      operationId: ids.duplicateOperation,
      aggregateId: ids.duplicateScript,
      baseVersion: 0,
    })
    await expect(conflicts.get(ids.conflict)).resolves.toBeNull()
  })

  it('does not resurrect deleted card tombstones in the local copy', async () => {
    const deletedCard = {
      ...local.cards[0]!,
      id: '019b9ccb-3f71-7000-8000-000000000315',
      position: 1,
      deletedAt: '2026-08-07T07:04:00.000Z',
      cueSet: {
        ...local.cards[0]!.cueSet,
        id: '019b9ccb-3f71-7000-8000-000000000316',
        cardId: '019b9ccb-3f71-7000-8000-000000000315',
      },
    }
    await conflicts.save({
      id: ids.conflict,
      aggregateId: ids.script,
      operationId: ids.operation,
      local: { ...local, cards: [local.cards[0]!, deletedCard] },
      server,
      createdAt: '2026-08-07T07:07:00.000Z',
    })

    const duplicateId = await action().duplicateLocal(ids.conflict)

    await expect(scripts.get(duplicateId)).resolves.toMatchObject({
      cards: [{
        position: 0,
        fullText: 'Локальный полный текст.',
        deletedAt: null,
      }],
    })
  })

  it('duplicates the live aggregate when it changed after the conflict was recorded', async () => {
    const newestLocal = {
      ...local,
      title: 'Правка после конфликта',
      sourceText: '# Правка после конфликта',
      updatedAt: '2026-08-07T07:07:30.000Z',
    }
    await scripts.save(newestLocal)
    await outbox.upsertLatestSnapshot({
      operationId: ids.operation,
      aggregateId: ids.script,
      baseVersion: 2,
      type: 'script.replace',
      payload: newestLocal,
      createdAt: '2026-08-07T07:07:30.000Z',
    })

    const duplicateId = await action().duplicateLocal(ids.conflict)

    await expect(scripts.get(duplicateId)).resolves.toMatchObject({
      title: 'Правка после конфликта (копия)',
      sourceText: '# Правка после конфликта',
    })
  })
})
