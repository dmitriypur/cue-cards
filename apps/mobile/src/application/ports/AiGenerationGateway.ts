import type { UUID } from '@/domain/scripts/types'

export type AiGenerationStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface AiGenerationError {
  readonly code: string
  readonly message: string
  readonly correlationId: string
}

export interface AiGeneration {
  readonly id: UUID
  readonly scriptId: UUID
  readonly cardId: UUID | null
  readonly status: AiGenerationStatus
  readonly completedCards: number
  readonly totalCards: number
  readonly error: AiGenerationError | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface AiGenerationGateway {
  startScript(scriptId: UUID, operationId: UUID): Promise<AiGeneration>
  startCard(cardId: UUID, replaceManual: boolean, operationId: UUID): Promise<AiGeneration>
  get(generationId: UUID): Promise<AiGeneration>
}
