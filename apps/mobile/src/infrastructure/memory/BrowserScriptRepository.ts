import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type {
  CueStatus,
  ScriptAggregate,
  ScriptSummary,
  UUID,
} from '@/domain/scripts/types'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

const STORAGE_KEY = 'cue_cards.e2e.scripts'

function aggregateCueStatus(script: ScriptAggregate): CueStatus {
  const activeCards = script.cards.filter(({ deletedAt }) => deletedAt === null)
  const statuses = activeCards.map(({ cueSet }) => cueSet.status)
  if (statuses.includes('failed')) return 'failed'
  if (statuses.includes('stale')) return 'stale'
  if (statuses.includes('generating')) return 'generating'
  if (statuses.includes('pending')) return 'pending'
  if (statuses.length > 0 && statuses.every((status) => status === 'ready')) return 'ready'
  return 'missing'
}

export class BrowserScriptRepository implements ScriptRepository {
  public async list(): Promise<readonly ScriptSummary[]> {
    return this.readAll()
      .filter(({ deletedAt }) => deletedAt === null)
      .map((script) => ({
        id: script.id,
        title: script.title,
        cardCount: script.cards.filter(({ deletedAt }) => deletedAt === null).length,
        offlineReadyCardCount: script.cards.filter(({ deletedAt, contentHash, cueSet }) => (
          deletedAt === null
          && cueSet.status === 'ready'
          && cueSet.sourceHash === contentHash
        )).length,
        cueStatus: aggregateCueStatus(script),
        syncStatus: script.syncStatus,
        lastOpenedAt: script.lastOpenedAt,
        updatedAt: script.updatedAt,
      }))
  }

  public async get(id: UUID, _tx?: SqlTransaction): Promise<ScriptAggregate | null> {
    return this.readAll().find((script) => script.id === id) ?? null
  }

  public async save(aggregate: ScriptAggregate, _tx?: SqlTransaction): Promise<void> {
    const scripts = this.readAll().filter(({ id }) => id !== aggregate.id)
    scripts.push(aggregate)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts))
  }

  public async softDelete(id: UUID, deletedAt: string, _tx?: SqlTransaction): Promise<void> {
    const script = await this.get(id)
    if (script === null) return
    await this.save({ ...script, deletedAt, updatedAt: deletedAt })
  }

  private readAll(): ScriptAggregate[] {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return []
    const value: unknown = JSON.parse(stored)
    return Array.isArray(value) ? value as ScriptAggregate[] : []
  }
}
