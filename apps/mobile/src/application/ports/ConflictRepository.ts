import type { ScriptAggregate, UUID } from '@/domain/scripts/types'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

export interface SyncConflictRecord {
  readonly id: UUID
  readonly aggregateId: UUID
  readonly operationId: UUID
  readonly local: ScriptAggregate
  readonly server: ScriptAggregate
  readonly createdAt: string
}

export interface ConflictRepository {
  get(id: UUID, tx?: SqlTransaction): Promise<SyncConflictRecord | null>
  list(): Promise<readonly SyncConflictRecord[]>
  save(conflict: SyncConflictRecord, tx?: SqlTransaction): Promise<void>
  remove(id: UUID, tx?: SqlTransaction): Promise<void>
}
