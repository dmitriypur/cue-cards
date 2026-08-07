import type { StoredOutboxCommand } from '@/application/ports/OutboxRepository'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

export interface SyncCommandResult {
  readonly operationId: UUID
  readonly aggregateId: UUID
  readonly version: number
  readonly duplicate: boolean
}

export interface SyncBatchResponse {
  readonly results: readonly SyncCommandResult[]
}

export interface SyncChange {
  readonly cursor: number
  readonly aggregateId: UUID
  readonly version: number
  readonly type: 'script.replace'
  readonly snapshot: ScriptAggregate
}

export interface SyncPage {
  readonly changes: readonly SyncChange[]
  readonly nextCursor: number
  readonly hasMore: boolean
}

export interface SyncGateway {
  submit(commands: readonly StoredOutboxCommand[]): Promise<SyncBatchResponse>
  changes(after: number): Promise<SyncPage>
}

export class SyncConflictError extends Error {
  public readonly aggregateId: UUID
  public readonly local: ScriptAggregate
  public readonly server: ScriptAggregate

  public constructor(aggregateId: UUID, local: ScriptAggregate, server: ScriptAggregate) {
    super('Synchronization version conflict')
    this.name = 'SyncConflictError'
    this.aggregateId = aggregateId
    this.local = local
    this.server = server
  }
}
