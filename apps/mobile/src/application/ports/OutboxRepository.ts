import type { ScriptAggregate, UUID } from '@/domain/scripts/types'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

export type OutboxCommandType = 'script.replace'
export type OutboxCommandState = 'pending' | 'in_flight'

export interface OutboxCommand {
  readonly operationId: UUID
  readonly aggregateId: UUID
  readonly baseVersion: number
  readonly type: OutboxCommandType
  readonly payload: ScriptAggregate
  readonly createdAt: string
}

export interface StoredOutboxCommand extends OutboxCommand {
  readonly state: OutboxCommandState
  readonly attempts: number
  readonly nextAttemptAt: string | null
}

export interface OutboxRepository {
  upsertLatestSnapshot(command: OutboxCommand, tx?: SqlTransaction): Promise<void>
  next(): Promise<StoredOutboxCommand | null>
  markInFlight(operationId: UUID): Promise<void>
  acknowledge(operationId: UUID, serverVersion: number): Promise<void>
  rebasePending(aggregateId: UUID, serverVersion: number): Promise<void>
}
