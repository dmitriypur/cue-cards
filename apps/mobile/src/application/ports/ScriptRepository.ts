import type { ScriptAggregate, ScriptSummary, UUID } from '@/domain/scripts/types'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

export interface ScriptRepository {
  list(): Promise<readonly ScriptSummary[]>
  get(id: UUID, tx?: SqlTransaction): Promise<ScriptAggregate | null>
  save(aggregate: ScriptAggregate, tx?: SqlTransaction): Promise<void>
  softDelete(id: UUID, deletedAt: string, tx?: SqlTransaction): Promise<void>
}
