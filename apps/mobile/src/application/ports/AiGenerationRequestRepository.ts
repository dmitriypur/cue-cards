import type { UUID } from '@/domain/scripts/types'

export interface AiGenerationRequest {
  readonly scopeKey: string
  readonly scriptId: UUID
  readonly cardId: UUID | null
  readonly operationId: UUID
  readonly localPrepared: boolean
  readonly replaceManual: boolean
  readonly generationId: UUID | null
  readonly createdAt: string
}

export interface AiGenerationRequestRepository {
  upsertPending(request: AiGenerationRequest): Promise<void>
  markPrepared(scopeKey: string): Promise<void>
  markStarted(scopeKey: string, generationId: UUID): Promise<void>
  removeByGeneration(generationId: UUID): Promise<void>
  list(): Promise<readonly AiGenerationRequest[]>
}
