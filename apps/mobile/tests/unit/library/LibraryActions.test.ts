import { describe, expect, it, vi } from 'vitest'

import { GetScript } from '@/application/scripts/GetScript'
import { ListScripts } from '@/application/scripts/ListScripts'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { ScriptAggregate, ScriptSummary } from '@/domain/scripts/types'

const summaries: readonly ScriptSummary[] = [
  {
    id: 'updated-later',
    title: 'Позже изменён',
    cardCount: 1,
    cueStatus: 'missing',
    syncStatus: 'local',
    lastOpenedAt: null,
    updatedAt: '2026-08-06T08:00:00.000Z',
  },
  {
    id: 'opened-first',
    title: 'Открыт недавно',
    cardCount: 1,
    cueStatus: 'ready',
    syncStatus: 'synced',
    lastOpenedAt: '2026-08-06T09:00:00.000Z',
    updatedAt: '2026-08-06T06:00:00.000Z',
  },
  {
    id: 'updated-earlier',
    title: 'Раньше изменён',
    cardCount: 1,
    cueStatus: 'ready',
    syncStatus: 'synced',
    lastOpenedAt: null,
    updatedAt: '2026-08-06T07:00:00.000Z',
  },
]

const aggregate: ScriptAggregate = {
  id: 'opened-first',
  title: 'Открыт недавно',
  sourceFormat: 'markdown',
  sourceText: '# Открыт недавно',
  importHash: 'synthetic-hash',
  serverVersion: 2,
  syncStatus: 'synced',
  cards: [],
  lastOpenedAt: '2026-08-06T09:00:00.000Z',
  createdAt: '2026-08-06T06:00:00.000Z',
  updatedAt: '2026-08-06T06:00:00.000Z',
  deletedAt: null,
}

function repository(overrides: Partial<ScriptRepository> = {}): ScriptRepository {
  return {
    list: vi.fn().mockResolvedValue(summaries),
    get: vi.fn().mockResolvedValue(aggregate),
    save: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('library application actions', () => {
  it('sorts by last opened timestamp and then updated timestamp descending', async () => {
    const result = await new ListScripts(repository()).execute()

    expect(result.map(({ id }) => id)).toEqual([
      'opened-first',
      'updated-later',
      'updated-earlier',
    ])
  })

  it('touches lastOpenedAt through aggregate persistence before returning a script', async () => {
    const save = { execute: vi.fn().mockImplementation(({ aggregate: next }) => next) }
    const action = new GetScript(
      repository(),
      save,
      { now: () => '2026-08-06T10:00:00.000Z' },
    )

    await expect(action.execute(aggregate.id)).resolves.toMatchObject({
      lastOpenedAt: '2026-08-06T10:00:00.000Z',
      updatedAt: '2026-08-06T10:00:00.000Z',
      syncStatus: 'pending',
    })
    expect(save.execute).toHaveBeenCalledWith({
      aggregate: expect.objectContaining({ id: aggregate.id, lastOpenedAt: '2026-08-06T10:00:00.000Z' }),
    })
  })

  it('rejects a missing or deleted script without persisting it', async () => {
    const save = { execute: vi.fn() }
    const missing = new GetScript(
      repository({ get: vi.fn().mockResolvedValue(null) }),
      save,
    )
    const deleted = new GetScript(
      repository({ get: vi.fn().mockResolvedValue({ ...aggregate, deletedAt: '2026-08-06T09:30:00.000Z' }) }),
      save,
    )

    await expect(missing.execute('missing')).rejects.toThrow('Script not found')
    await expect(deleted.execute(aggregate.id)).rejects.toThrow('Script not found')
    expect(save.execute).not.toHaveBeenCalled()
  })
})
