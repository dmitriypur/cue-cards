import { ApiError, type RequestClient } from '@/application/ports/ApiClient'
import type { StoredOutboxCommand } from '@/application/ports/OutboxRepository'
import {
  SyncConflictError,
  type SyncBatchResponse,
  type SyncGateway,
  type SyncPage,
} from '@/application/ports/SyncGateway'
import type { ScriptAggregate } from '@/domain/scripts/types'
import type { components } from '@/infrastructure/api/generated/schema'

type ServerSnapshot = components['schemas']['ScriptSnapshot']
type BatchRequest = components['schemas']['SyncBatchRequest']
type BatchTransport = components['schemas']['SyncBatchResponse']
type PageTransport = components['schemas']['SyncPageResponse']

export class HttpSyncGateway implements SyncGateway {
  private readonly client: RequestClient

  public constructor(client: RequestClient) { this.client = client }

  public async submit(commands: readonly StoredOutboxCommand[]): Promise<SyncBatchResponse> {
    const body = {
      commands: commands.map((command) => ({
        operation_id: command.operationId,
        aggregate_id: command.aggregateId,
        type: command.type,
        base_version: command.baseVersion,
        payload: this.toServerSnapshot(command.payload),
        created_at: command.createdAt,
      })),
    } satisfies BatchRequest
    try {
      const response = await this.client.request<BatchTransport>({
        method: 'POST',
        path: '/api/v1/sync/commands',
        authenticated: true,
        body,
      })
      return {
        results: response.data.results.map((result) => ({
          operationId: result.operation_id,
          aggregateId: result.aggregate_id,
          version: result.version,
          duplicate: result.duplicate,
        })),
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409 && this.isConflict(error.details)) {
        throw new SyncConflictError(
          error.details.aggregate_id,
          this.fromServerSnapshot(error.details.local),
          this.fromServerSnapshot(error.details.server),
        )
      }
      throw error
    }
  }

  public async changes(after: number): Promise<SyncPage> {
    const response = await this.client.request<PageTransport>({
      method: 'GET',
      path: `/api/v1/sync?after=${encodeURIComponent(String(after))}`,
      authenticated: true,
    })
    return {
      changes: response.data.changes.map((change) => ({
        cursor: change.cursor,
        aggregateId: change.aggregate_id,
        version: change.version,
        type: change.type,
        snapshot: this.fromServerSnapshot(change.snapshot),
      })),
      nextCursor: response.data.next_cursor,
      hasMore: response.data.has_more,
    }
  }

  private toServerSnapshot(snapshot: ScriptAggregate): ServerSnapshot {
    return {
      id: snapshot.id,
      title: snapshot.title,
      source_format: snapshot.sourceFormat,
      source_text: snapshot.sourceText,
      import_hash: snapshot.importHash,
      status: snapshot.deletedAt === null ? 'ready' : 'archived',
      version: snapshot.serverVersion,
      last_opened_at: snapshot.lastOpenedAt,
      updated_at: snapshot.updatedAt,
      deleted_at: snapshot.deletedAt,
      cards: snapshot.cards.map((card) => ({
        id: card.id,
        script_id: card.scriptId,
        position: card.position,
        title: card.title,
        full_text: card.fullText,
        content_hash: card.contentHash,
        version: card.version,
        deleted_at: card.deletedAt,
        cue_set: {
          id: card.cueSet.id,
          card_id: card.cueSet.cardId,
          cues: [...card.cueSet.cues],
          source_hash: card.cueSet.sourceHash,
          status: card.cueSet.status,
          generation_id: card.cueSet.generationId,
          manually_edited: card.cueSet.manuallyEdited,
          version: card.cueSet.version,
        },
      })),
    }
  }

  private fromServerSnapshot(snapshot: ServerSnapshot): ScriptAggregate {
    return {
      id: snapshot.id,
      title: snapshot.title,
      sourceFormat: snapshot.source_format,
      sourceText: snapshot.source_text,
      importHash: snapshot.import_hash,
      serverVersion: snapshot.version,
      syncStatus: 'synced',
      lastOpenedAt: snapshot.last_opened_at ?? null,
      createdAt: snapshot.updated_at,
      updatedAt: snapshot.updated_at,
      deletedAt: snapshot.deleted_at ?? null,
      cards: snapshot.cards.map((card) => ({
        id: card.id,
        scriptId: card.script_id,
        position: card.position,
        title: card.title,
        fullText: card.full_text,
        contentHash: card.content_hash,
        version: card.version,
        createdAt: snapshot.updated_at,
        updatedAt: snapshot.updated_at,
        deletedAt: card.deleted_at ?? null,
        cueSet: card.cue_set === null
          ? {
              id: card.id,
              cardId: card.id,
              cues: [],
              sourceHash: null,
              status: 'missing',
              generationId: null,
              manuallyEdited: false,
              version: 0,
              createdAt: snapshot.updated_at,
              updatedAt: snapshot.updated_at,
            }
          : {
              id: card.cue_set.id,
              cardId: card.cue_set.card_id,
              cues: card.cue_set.cues,
              sourceHash: card.cue_set.source_hash,
              status: card.cue_set.status,
              generationId: card.cue_set.generation_id,
              manuallyEdited: card.cue_set.manually_edited,
              version: card.cue_set.version,
              createdAt: snapshot.updated_at,
              updatedAt: snapshot.updated_at,
            },
      })),
    }
  }

  private isConflict(value: unknown): value is {
    aggregate_id: string
    local: ServerSnapshot
    server: ServerSnapshot
  } {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return typeof record.aggregate_id === 'string'
      && typeof record.local === 'object' && record.local !== null
      && typeof record.server === 'object' && record.server !== null
  }
}
