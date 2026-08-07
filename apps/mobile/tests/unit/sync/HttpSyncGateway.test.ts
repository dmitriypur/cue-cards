import { describe, expect, it } from 'vitest'

import { ApiError, type ApiOperation, type RequestClient } from '@/application/ports/ApiClient'
import { SyncConflictError } from '@/application/ports/SyncGateway'
import type { ScriptAggregate } from '@/domain/scripts/types'
import { HttpSyncGateway } from '@/infrastructure/api/HttpSyncGateway'

const aggregate: ScriptAggregate = {
  id: '019b9ccb-3f71-7000-8000-000000000410',
  title: 'Синтетический сценарий',
  sourceFormat: 'markdown',
  sourceText: '# Синтетический сценарий',
  importHash: 'import-hash',
  serverVersion: 2,
  syncStatus: 'pending',
  cards: [{
    id: '019b9ccb-3f71-7000-8000-000000000411',
    scriptId: '019b9ccb-3f71-7000-8000-000000000410',
    position: 0,
    title: 'Блок',
    fullText: 'Полный синтетический текст.',
    contentHash: 'content-hash',
    version: 1,
    cueSet: {
      id: '019b9ccb-3f71-7000-8000-000000000412',
      cardId: '019b9ccb-3f71-7000-8000-000000000411',
      cues: ['Один', 'Два', 'Три'],
      sourceHash: 'content-hash',
      status: 'ready',
      generationId: null,
      manuallyEdited: false,
      version: 1,
      createdAt: '2026-08-07T07:00:00.000Z',
      updatedAt: '2026-08-07T07:05:00.000Z',
    },
    createdAt: '2026-08-07T07:00:00.000Z',
    updatedAt: '2026-08-07T07:05:00.000Z',
    deletedAt: null,
  }],
  lastOpenedAt: null,
  createdAt: '2026-08-07T07:00:00.000Z',
  updatedAt: '2026-08-07T07:05:00.000Z',
  deletedAt: null,
}

class FakeClient implements RequestClient {
  public readonly operations: ApiOperation<unknown>[] = []
  public response: unknown = undefined
  public error: Error | null = null

  public request<T>(operation: ApiOperation<T>): Promise<T> {
    this.operations.push(operation)
    if (this.error !== null) return Promise.reject(this.error)
    return Promise.resolve(this.response as T)
  }
}

describe('HttpSyncGateway', () => {
  it('submits only the OpenAPI command fields and maps the acceptance', async () => {
    const client = new FakeClient()
    client.response = { data: { results: [{
      operation_id: '019b9ccb-3f71-7000-8000-000000000413',
      aggregate_id: aggregate.id,
      version: 3,
      duplicate: false,
    }] } }
    const gateway = new HttpSyncGateway(client)

    const result = await gateway.submit([{
      operationId: '019b9ccb-3f71-7000-8000-000000000413',
      aggregateId: aggregate.id,
      baseVersion: 2,
      type: 'script.replace',
      payload: aggregate,
      createdAt: '2026-08-07T07:06:00.000Z',
      state: 'in_flight',
      attempts: 4,
      nextAttemptAt: null,
    }])

    expect(client.operations).toEqual([{
      method: 'POST',
      path: '/api/v1/sync/commands',
      authenticated: true,
      body: { commands: [{
        operation_id: '019b9ccb-3f71-7000-8000-000000000413',
        aggregate_id: aggregate.id,
        base_version: 2,
        type: 'script.replace',
        created_at: '2026-08-07T07:06:00.000Z',
        payload: expect.objectContaining({
          id: aggregate.id,
          source_format: 'markdown',
          source_text: aggregate.sourceText,
          status: 'ready',
          version: 2,
        }),
      }] },
    }])
    expect(result.results).toEqual([{
      operationId: '019b9ccb-3f71-7000-8000-000000000413',
      aggregateId: aggregate.id,
      version: 3,
      duplicate: false,
    }])
  })

  it('maps cursor changes into application snapshots', async () => {
    const client = new FakeClient()
    client.response = { data: {
      changes: [{
        cursor: 8,
        aggregate_id: aggregate.id,
        version: 3,
        type: 'script.replace',
        snapshot: {
          id: aggregate.id,
          title: aggregate.title,
          source_format: 'markdown',
          source_text: aggregate.sourceText,
          import_hash: aggregate.importHash,
          status: 'ready',
          version: 3,
          last_opened_at: null,
          updated_at: aggregate.updatedAt,
          deleted_at: null,
          cards: [{
            id: aggregate.cards[0]!.id,
            script_id: aggregate.id,
            position: 0,
            title: 'Блок',
            full_text: 'Полный синтетический текст.',
            content_hash: 'content-hash',
            version: 1,
            deleted_at: null,
            cue_set: {
              id: aggregate.cards[0]!.cueSet.id,
              card_id: aggregate.cards[0]!.id,
              cues: ['Один', 'Два', 'Три'],
              source_hash: 'content-hash',
              status: 'ready',
              generation_id: null,
              manually_edited: false,
              version: 1,
            },
          }],
        },
      }],
      next_cursor: 8,
      has_more: false,
    } }

    const page = await new HttpSyncGateway(client).changes(7)

    expect(client.operations[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/sync?after=7',
      authenticated: true,
    })
    expect(page).toMatchObject({
      nextCursor: 8,
      hasMore: false,
      changes: [{ snapshot: { serverVersion: 3, syncStatus: 'synced' } }],
    })
  })

  it('maps a nullable server cue set to a stable missing local cue set', async () => {
    const card = aggregate.cards[0]!
    const client = new FakeClient()
    client.response = { data: {
      changes: [{
        cursor: 8,
        aggregate_id: aggregate.id,
        version: 3,
        type: 'script.replace',
        snapshot: {
          id: aggregate.id,
          title: aggregate.title,
          source_format: 'markdown',
          source_text: aggregate.sourceText,
          import_hash: aggregate.importHash,
          status: 'ready',
          version: 3,
          last_opened_at: null,
          updated_at: aggregate.updatedAt,
          deleted_at: null,
          cards: [{
            id: card.id,
            script_id: aggregate.id,
            position: 0,
            title: card.title,
            full_text: card.fullText,
            content_hash: card.contentHash,
            version: card.version,
            deleted_at: null,
            cue_set: null,
          }],
        },
      }],
      next_cursor: 8,
      has_more: false,
    } }

    const page = await new HttpSyncGateway(client).changes(7)

    expect(page.changes[0]?.snapshot.cards[0]?.cueSet).toEqual({
      id: card.id,
      cardId: card.id,
      cues: [],
      sourceHash: null,
      status: 'missing',
      generationId: null,
      manuallyEdited: false,
      version: 0,
      createdAt: aggregate.updatedAt,
      updatedAt: aggregate.updatedAt,
    })
  })

  it('preserves local and server snapshots from a version conflict', async () => {
    const client = new FakeClient()
    const wireSnapshot = {
      id: aggregate.id,
      title: aggregate.title,
      source_format: 'markdown' as const,
      source_text: aggregate.sourceText,
      import_hash: aggregate.importHash,
      status: 'ready' as const,
      version: 2,
      last_opened_at: null,
      updated_at: aggregate.updatedAt,
      deleted_at: null,
      cards: [{
        id: aggregate.cards[0]!.id,
        script_id: aggregate.id,
        position: 0,
        title: 'Блок',
        full_text: 'Полный синтетический текст.',
        content_hash: 'content-hash',
        version: 1,
        deleted_at: null,
        cue_set: {
          id: aggregate.cards[0]!.cueSet.id,
          card_id: aggregate.cards[0]!.id,
          cues: ['Один', 'Два', 'Три'],
          source_hash: 'content-hash',
          status: 'ready' as const,
          generation_id: null,
          manually_edited: false,
          version: 1,
        },
      }],
    }
    client.error = new ApiError(409, 'SYNC_VERSION_CONFLICT', 'Конфликт.', 'correlation', undefined, {
      aggregate_id: aggregate.id,
      local: wireSnapshot,
      server: { ...wireSnapshot, title: 'Серверная версия', version: 3 },
    })

    await expect(new HttpSyncGateway(client).submit([])).rejects.toBeInstanceOf(SyncConflictError)
    await expect(new HttpSyncGateway(client).submit([])).rejects.toMatchObject({
      aggregateId: aggregate.id,
      local: { title: aggregate.title },
      server: { title: 'Серверная версия' },
    })
  })
})
