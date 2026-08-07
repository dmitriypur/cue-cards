import type {
  AiGeneration,
  AiGenerationGateway,
} from '@/application/ports/AiGenerationGateway'
import type { RequestClient } from '@/application/ports/ApiClient'
import type { UUID } from '@/domain/scripts/types'
import type { components } from '@/infrastructure/api/generated/schema'

type AiGenerationResponse = components['schemas']['AiGenerationResponse']
type AiGenerationTransport = components['schemas']['AiGeneration']

export class HttpAiGenerationGateway implements AiGenerationGateway {
  private readonly client: RequestClient

  public constructor(client: RequestClient) {
    this.client = client
  }

  public async startScript(scriptId: UUID, operationId: UUID): Promise<AiGeneration> {
    return this.request(
      'POST',
      `/api/v1/scripts/${encodeURIComponent(scriptId)}/cue-generations`,
      { operation_id: operationId },
    )
  }

  public async startCard(
    cardId: UUID,
    replaceManual: boolean,
    operationId: UUID,
  ): Promise<AiGeneration> {
    return this.request(
      'POST',
      `/api/v1/cards/${encodeURIComponent(cardId)}/cue-generations`,
      { replace_manual: replaceManual, operation_id: operationId },
    )
  }

  public async get(generationId: UUID): Promise<AiGeneration> {
    return this.request('GET', `/api/v1/ai-generations/${encodeURIComponent(generationId)}`)
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<AiGeneration> {
    const response = await this.client.request<AiGenerationResponse>({
      method,
      path,
      authenticated: true,
      ...(body === undefined ? {} : { body }),
    })
    return this.fromTransport(response.data)
  }

  private fromTransport(generation: AiGenerationTransport): AiGeneration {
    return {
      id: generation.id,
      scriptId: generation.script_id,
      cardId: generation.card_id,
      status: generation.status,
      completedCards: generation.completed_cards,
      totalCards: generation.total_cards,
      error: generation.error === undefined || generation.error === null
        ? null
        : {
            code: generation.error.code,
            message: generation.error.message,
            correlationId: generation.error.correlation_id,
          },
      createdAt: generation.created_at,
      updatedAt: generation.updated_at,
    }
  }
}
