import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DeleteScript } from '@/application/scripts/DeleteScript'
import { SaveScriptAggregate } from '@/application/scripts/SaveScriptAggregate'
import type { ScriptAggregate } from '@/domain/scripts/types'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'
import { migrateInitialSchema } from '@/infrastructure/sqlite/migrations/001_initial'
import { SqliteOutboxRepository } from '@/infrastructure/sqlite/SqliteOutboxRepository'
import { SqliteScriptRepository } from '@/infrastructure/sqlite/SqliteScriptRepository'
import { InMemorySqlDriver } from '../../helpers/InMemorySqlDriver'

const script: ScriptAggregate = {
  id: '019b9ccb-3f71-7000-8000-000000000210',
  title: 'Сценарий для удаления',
  sourceFormat: 'text',
  sourceText: 'Сценарий для удаления\n\nСинтетический текст.',
  importHash: 'delete-test-hash',
  serverVersion: 3,
  syncStatus: 'pending',
  lastOpenedAt: null,
  createdAt: '2026-08-06T08:00:00.000Z',
  updatedAt: '2026-08-06T08:00:00.000Z',
  deletedAt: null,
  cards: [{
    id: '019b9ccb-3f71-7000-8000-000000000211',
    scriptId: '019b9ccb-3f71-7000-8000-000000000210',
    position: 0,
    title: 'Блок',
    fullText: 'Синтетический текст.',
    contentHash: 'card-hash',
    version: 1,
    createdAt: '2026-08-06T08:00:00.000Z',
    updatedAt: '2026-08-06T08:00:00.000Z',
    deletedAt: null,
    cueSet: {
      id: '019b9ccb-3f71-7000-8000-000000000212',
      cardId: '019b9ccb-3f71-7000-8000-000000000211',
      cues: [],
      sourceHash: null,
      status: 'missing',
      generationId: null,
      manuallyEdited: false,
      version: 0,
      createdAt: '2026-08-06T08:00:00.000Z',
      updatedAt: '2026-08-06T08:00:00.000Z',
    },
  }],
}

describe('DeleteScript', () => {
  let driver: InMemorySqlDriver
  let scripts: SqliteScriptRepository
  let outbox: SqliteOutboxRepository
  let save: SaveScriptAggregate
  let action: DeleteScript

  beforeEach(async () => {
    driver = new InMemorySqlDriver()
    await migrateInitialSchema(driver)
    scripts = new SqliteScriptRepository(driver)
    outbox = new SqliteOutboxRepository(driver)
    let operation = 0
    save = new SaveScriptAggregate(
      scripts,
      outbox,
      new LocalUnitOfWork(driver),
      { now: () => '2026-08-06T09:00:00.000Z' },
      () => `019b9ccb-3f71-7000-8000-00000000022${operation++}`,
    )
    action = new DeleteScript(
      scripts,
      save,
      { now: () => '2026-08-06T10:00:00.000Z' },
    )
    await save.execute({ aggregate: script })
  })

  afterEach(() => {
    driver.close()
  })

  it('soft-deletes the complete local aggregate and coalesces its outbox snapshot', async () => {
    await action.execute(script.id)

    await expect(scripts.list()).resolves.toEqual([])
    await expect(scripts.get(script.id)).resolves.toMatchObject({
      deletedAt: '2026-08-06T10:00:00.000Z',
      syncStatus: 'pending',
      cards: [expect.objectContaining({ deletedAt: null })],
    })

    const commands = await driver.query('SELECT * FROM outbox_commands')
    expect(commands).toHaveLength(1)
    expect(JSON.parse(String(commands[0]?.payload))).toMatchObject({
      id: script.id,
      deletedAt: '2026-08-06T10:00:00.000Z',
    })
  })

  it('undoes a pending deletion by replacing the same pending snapshot', async () => {
    await action.execute(script.id)
    await action.undo(script.id)

    await expect(scripts.list()).resolves.toHaveLength(1)
    await expect(scripts.get(script.id)).resolves.toMatchObject({
      deletedAt: null,
      cards: [expect.objectContaining({ deletedAt: null })],
    })
    const commands = await driver.query('SELECT * FROM outbox_commands')
    expect(commands).toHaveLength(1)
    expect(JSON.parse(String(commands[0]?.payload))).toMatchObject({ deletedAt: null })
  })

  it('creates one restored successor when the deletion is already in flight', async () => {
    await action.execute(script.id)
    const deletion = await outbox.next()
    expect(deletion).not.toBeNull()
    await outbox.markInFlight(deletion!.operationId)

    await action.undo(script.id)

    const commands = await driver.query(
      'SELECT state, payload FROM outbox_commands ORDER BY created_at, operation_id',
    )
    expect(commands.map(({ state }) => state)).toEqual(['in_flight', 'pending'])
    expect(JSON.parse(String(commands[1]?.payload))).toMatchObject({ deletedAt: null })
  })

  it('preserves card tombstones when deleting and restoring the script', async () => {
    const tombstonedAt = '2026-08-06T10:00:00.000Z'
    const deletedCard = {
      ...script.cards[0]!,
      id: '019b9ccb-3f71-7000-8000-000000000213',
      position: 1,
      deletedAt: tombstonedAt,
      cueSet: {
        ...script.cards[0]!.cueSet,
        id: '019b9ccb-3f71-7000-8000-000000000214',
        cardId: '019b9ccb-3f71-7000-8000-000000000213',
      },
    }
    await save.execute({ aggregate: { ...script, cards: [...script.cards, deletedCard] } })

    await action.execute(script.id)
    await action.undo(script.id)

    const restored = await scripts.get(script.id)
    expect(restored?.cards.find(({ id }) => id === deletedCard.id)?.deletedAt).toBe(tombstonedAt)
  })
})
