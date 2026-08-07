import { afterEach, describe, expect, it } from 'vitest'

import { SqliteAiGenerationRequestRepository } from '@/infrastructure/sqlite/SqliteAiGenerationRequestRepository'
import { migrateInitialSchema } from '@/infrastructure/sqlite/migrations/001_initial'
import { migrateSyncConflicts } from '@/infrastructure/sqlite/migrations/002_sync_conflicts'
import { migrateAiGenerationRequests } from '@/infrastructure/sqlite/migrations/003_ai_generation_requests'
import { InMemorySqlDriver } from '@/../tests/helpers/InMemorySqlDriver'

const drivers: InMemorySqlDriver[] = []

afterEach(() => {
  for (const driver of drivers.splice(0)) driver.close()
})

describe('SQLite AI generation requests', () => {
  it('persists pending and tracked generation intent across repository instances', async () => {
    const driver = new InMemorySqlDriver()
    drivers.push(driver)
    await migrateInitialSchema(driver)
    await migrateSyncConflicts(driver)
    await migrateAiGenerationRequests(driver)
    await driver.run(
      `INSERT INTO scripts (
        id, title, source_format, source_text, import_hash, server_version,
        sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['script-1', 'Сценарий', 'markdown', '# Сценарий', 'hash', 1, 'synced',
        '2026-08-07T11:00:00.000Z', '2026-08-07T11:00:00.000Z'],
    )
    await driver.run(
      `INSERT INTO cards (
        id, script_id, position, title, full_text, content_hash, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['card-1', 'script-1', 0, 'Карточка', 'Текст', 'hash', 1,
        '2026-08-07T11:00:00.000Z', '2026-08-07T11:00:00.000Z'],
    )
    const first = new SqliteAiGenerationRequestRepository(driver)

    await first.upsertPending({
      scopeKey: 'card:card-1',
      scriptId: 'script-1',
      cardId: 'card-1',
      operationId: '019b9ccb-3f71-7000-8000-000000000530',
      localPrepared: false,
      replaceManual: true,
      generationId: null,
      createdAt: '2026-08-07T12:00:00.000Z',
    })
    await first.markPrepared('card:card-1')
    await first.markStarted('card:card-1', 'generation-1')

    const restored = await new SqliteAiGenerationRequestRepository(driver).list()
    expect(restored).toEqual([{
      scopeKey: 'card:card-1',
      scriptId: 'script-1',
      cardId: 'card-1',
      operationId: '019b9ccb-3f71-7000-8000-000000000530',
      localPrepared: true,
      replaceManual: true,
      generationId: 'generation-1',
      createdAt: '2026-08-07T12:00:00.000Z',
    }])

    await first.removeByGeneration('generation-1')
    await expect(first.list()).resolves.toEqual([])
  })
})
