import { describe, expect, it } from 'vitest'

import type { ApiOperation, RequestClient } from '@/application/ports/ApiClient'
import { HttpAiGenerationGateway } from '@/infrastructure/api/HttpAiGenerationGateway'

const transport = {
  data: {
    id: '019b9ccb-3f71-7000-8000-000000000520',
    script_id: '019b9ccb-3f71-7000-8000-000000000510',
    card_id: null,
    status: 'running' as const,
    completed_cards: 1,
    total_cards: 3,
    error: null,
    created_at: '2026-08-07T12:00:00.000Z',
    updated_at: '2026-08-07T12:01:00.000Z',
  },
}

class FakeClient implements RequestClient {
  public readonly operations: ApiOperation<unknown>[] = []

  public async request<T>(operation: ApiOperation<T>): Promise<T> {
    this.operations.push(operation)
    return transport as T
  }
}

describe('HttpAiGenerationGateway', () => {
  it('maps the three authenticated OpenAPI operations into one application shape', async () => {
    const client = new FakeClient()
    const gateway = new HttpAiGenerationGateway(client)

    const operationId = '019b9ccb-3f71-7000-8000-000000000530'
    const script = await gateway.startScript(transport.data.script_id, operationId)
    const card = await gateway.startCard(
      '019b9ccb-3f71-7000-8000-000000000511',
      true,
      operationId,
    )
    const refreshed = await gateway.get(transport.data.id)

    expect(client.operations).toEqual([
      {
        method: 'POST',
        path: `/api/v1/scripts/${transport.data.script_id}/cue-generations`,
        authenticated: true,
        body: { operation_id: operationId },
      },
      {
        method: 'POST',
        path: '/api/v1/cards/019b9ccb-3f71-7000-8000-000000000511/cue-generations',
        authenticated: true,
        body: { replace_manual: true, operation_id: operationId },
      },
      {
        method: 'GET',
        path: `/api/v1/ai-generations/${transport.data.id}`,
        authenticated: true,
      },
    ])
    expect(script).toEqual({
      id: transport.data.id,
      scriptId: transport.data.script_id,
      cardId: null,
      status: 'running',
      completedCards: 1,
      totalCards: 3,
      error: null,
      createdAt: transport.data.created_at,
      updatedAt: transport.data.updated_at,
    })
    expect(card).toEqual(script)
    expect(refreshed).toEqual(script)
  })
})
