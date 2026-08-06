import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SaveScriptAggregate } from '@/application/scripts/SaveScriptAggregate'
import type { ScriptAggregate } from '@/domain/scripts/types'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'
import { migrateInitialSchema } from '@/infrastructure/sqlite/migrations/001_initial'
import { SqliteOutboxRepository } from '@/infrastructure/sqlite/SqliteOutboxRepository'
import { SqliteRecordingSessionRepository } from '@/infrastructure/sqlite/SqliteRecordingSessionRepository'
import { SqliteScriptRepository } from '@/infrastructure/sqlite/SqliteScriptRepository'
import { InMemorySqlDriver } from '../../helpers/InMemorySqlDriver'

const aggregate: ScriptAggregate = {
  id: '019b9ccb-3f71-7000-8000-000000000010',
  title: 'Синтетический сценарий',
  sourceFormat: 'markdown',
  sourceText: '# Синтетический сценарий',
  importHash: 'import-hash',
  serverVersion: 4,
  syncStatus: 'pending',
  lastOpenedAt: null,
  createdAt: '2026-08-06T06:00:00.000Z',
  updatedAt: '2026-08-06T06:05:00.000Z',
  deletedAt: null,
  cards: [
    {
      id: '019b9ccb-3f71-7000-8000-000000000011',
      scriptId: '019b9ccb-3f71-7000-8000-000000000010',
      position: 0,
      title: 'Первый блок',
      fullText: 'Полный синтетический текст первого блока.',
      contentHash: 'first-hash',
      version: 2,
      createdAt: '2026-08-06T06:00:00.000Z',
      updatedAt: '2026-08-06T06:05:00.000Z',
      deletedAt: null,
      cueSet: {
        id: '019b9ccb-3f71-7000-8000-000000000012',
        cardId: '019b9ccb-3f71-7000-8000-000000000011',
        cues: ['Открыть тему', 'Раскрыть проблему', 'Обозначить вывод'],
        sourceHash: 'first-hash',
        status: 'ready',
        generationId: null,
        manuallyEdited: false,
        version: 1,
        createdAt: '2026-08-06T06:00:00.000Z',
        updatedAt: '2026-08-06T06:05:00.000Z',
      },
    },
    {
      id: '019b9ccb-3f71-7000-8000-000000000013',
      scriptId: '019b9ccb-3f71-7000-8000-000000000010',
      position: 1,
      title: 'Второй блок',
      fullText: 'Полный синтетический текст второго блока.',
      contentHash: 'second-hash',
      version: 1,
      createdAt: '2026-08-06T06:00:00.000Z',
      updatedAt: '2026-08-06T06:05:00.000Z',
      deletedAt: null,
      cueSet: {
        id: '019b9ccb-3f71-7000-8000-000000000014',
        cardId: '019b9ccb-3f71-7000-8000-000000000013',
        cues: [],
        sourceHash: null,
        status: 'missing',
        generationId: null,
        manuallyEdited: false,
        version: 0,
        createdAt: '2026-08-06T06:00:00.000Z',
        updatedAt: '2026-08-06T06:05:00.000Z',
      },
    },
  ],
}

describe('SaveScriptAggregate', () => {
  let driver: InMemorySqlDriver

  beforeEach(async () => {
    driver = new InMemorySqlDriver()
    await migrateInitialSchema(driver)
  })

  afterEach(() => {
    driver.close()
  })

  function makeAction(
    operationId = '019b9ccb-3f71-7000-8000-000000000099',
  ): SaveScriptAggregate {
    return new SaveScriptAggregate(
      new SqliteScriptRepository(driver),
      new SqliteOutboxRepository(driver),
      new LocalUnitOfWork(driver),
      { now: () => '2026-08-06T06:06:00.000Z' },
      () => operationId,
    )
  }

  it('persists the complete snapshot and one outbox command atomically', async () => {
    await makeAction().execute({ aggregate })

    await expect(new SqliteScriptRepository(driver).get(aggregate.id)).resolves.toEqual(aggregate)

    const scripts = await driver.query('SELECT * FROM scripts')
    const cards = await driver.query('SELECT * FROM cards ORDER BY position')
    const cueSets = await driver.query('SELECT * FROM cue_sets ORDER BY card_id')
    const outbox = await driver.query('SELECT * FROM outbox_commands')

    expect(scripts).toHaveLength(1)
    expect(scripts[0]).toMatchObject({ id: aggregate.id, title: aggregate.title, server_version: 4 })
    expect(cards.map((row) => row.id)).toEqual(aggregate.cards.map((card) => card.id))
    expect(cueSets).toHaveLength(2)
    expect(JSON.parse(String(cueSets[0]?.cues))).toEqual(aggregate.cards[0]?.cueSet.cues)
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({
      operation_id: '019b9ccb-3f71-7000-8000-000000000099',
      aggregate_id: aggregate.id,
      base_version: 4,
      type: 'script.replace',
      state: 'pending',
    })
    expect(JSON.parse(String(outbox[0]?.payload))).toEqual(aggregate)
  })

  it('rolls back the aggregate when the outbox insert fails', async () => {
    driver.failNextStatementContaining('INSERT INTO outbox_commands')

    await expect(makeAction().execute({ aggregate })).rejects.toThrow('Injected SQL failure')

    await expect(driver.query('SELECT * FROM scripts')).resolves.toEqual([])
    await expect(driver.query('SELECT * FROM cards')).resolves.toEqual([])
    await expect(driver.query('SELECT * FROM cue_sets')).resolves.toEqual([])
  })

  it('coalesces a newer snapshot into the pending command without rebasing it', async () => {
    await makeAction().execute({ aggregate })
    const updatedAggregate: ScriptAggregate = {
      ...aggregate,
      title: 'Обновлённый сценарий',
      serverVersion: 9,
      updatedAt: '2026-08-06T06:07:00.000Z',
    }

    await makeAction('019b9ccb-3f71-7000-8000-000000000100').execute({
      aggregate: updatedAggregate,
    })

    const outbox = await driver.query('SELECT * FROM outbox_commands')
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({
      operation_id: '019b9ccb-3f71-7000-8000-000000000099',
      base_version: 4,
      state: 'pending',
    })
    expect(JSON.parse(String(outbox[0]?.payload))).toEqual(updatedAggregate)
  })

  it('adds one pending snapshot when the previous command is in flight', async () => {
    await makeAction().execute({ aggregate })
    const outbox = new SqliteOutboxRepository(driver)
    await outbox.markInFlight('019b9ccb-3f71-7000-8000-000000000099')

    await makeAction('019b9ccb-3f71-7000-8000-000000000100').execute({
      aggregate: { ...aggregate, title: 'Следующая локальная версия' },
    })

    const commands = await driver.query(
      'SELECT * FROM outbox_commands ORDER BY created_at, operation_id',
    )
    expect(commands).toHaveLength(2)
    expect(commands.map((row) => [row.operation_id, row.state])).toEqual([
      ['019b9ccb-3f71-7000-8000-000000000099', 'in_flight'],
      ['019b9ccb-3f71-7000-8000-000000000100', 'pending'],
    ])
  })

  it('preserves the recording cursor when an existing aggregate is saved', async () => {
    await makeAction().execute({ aggregate })
    const sessions = new SqliteRecordingSessionRepository(driver)
    await sessions.save({
      scriptId: aggregate.id,
      currentCardId: aggregate.cards[1]!.id,
      mode: 'full',
      fontScale: 1.25,
      updatedAt: '2026-08-06T06:06:30.000Z',
    })

    await makeAction().execute({
      aggregate: { ...aggregate, title: 'Сценарий после редактирования' },
    })

    await expect(sessions.get(aggregate.id)).resolves.toMatchObject({
      currentCardId: aggregate.cards[1]!.id,
      mode: 'full',
      fontScale: 1.25,
    })
  })
})
