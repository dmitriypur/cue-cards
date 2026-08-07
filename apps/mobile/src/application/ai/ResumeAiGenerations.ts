import type { RefreshGeneration } from '@/application/ai/RefreshGeneration'
import type { StartCardCueGeneration } from '@/application/ai/StartCardCueGeneration'
import type {
  StartGenerationResult,
  StartScriptCueGeneration,
} from '@/application/ai/StartScriptCueGeneration'
import type { AiGenerationRequestRepository } from '@/application/ports/AiGenerationRequestRepository'
import { ApiError } from '@/application/ports/ApiClient'
import type { UUID } from '@/domain/scripts/types'

export interface ResumedGenerationEvents {
  accepted(scopeKey: string, result: StartGenerationResult): void
  updated(scopeKey: string, generation: import('@/application/ports/AiGenerationGateway').AiGeneration): void
  failed(scopeKey: string, error: unknown): void
}

const noEvents: ResumedGenerationEvents = {
  accepted: () => undefined,
  updated: () => undefined,
  failed: () => undefined,
}

export class ResumeAiGenerations {
  private readonly active = new Set<UUID>()
  private running: Promise<void> | null = null
  private readonly requests: AiGenerationRequestRepository
  private readonly startScript: Pick<StartScriptCueGeneration, 'execute'>
  private readonly startCard: Pick<StartCardCueGeneration, 'execute'>
  private readonly refresh: Pick<RefreshGeneration, 'track'>
  private readonly events: ResumedGenerationEvents

  public constructor(
    requests: AiGenerationRequestRepository,
    startScript: Pick<StartScriptCueGeneration, 'execute'>,
    startCard: Pick<StartCardCueGeneration, 'execute'>,
    refresh: Pick<RefreshGeneration, 'track'>,
    events: ResumedGenerationEvents = noEvents,
  ) {
    this.requests = requests
    this.startScript = startScript
    this.startCard = startCard
    this.refresh = refresh
    this.events = events
  }

  public execute(): Promise<void> {
    if (this.running !== null) return this.running
    this.running = this.resume().finally(() => { this.running = null })
    return this.running
  }

  private async resume(): Promise<void> {
    const requests = await this.requests.list()
    await Promise.all(requests.map(async (request) => {
      try {
        if (request.generationId !== null) {
          this.track(request.scopeKey, request.generationId)
          return
        }
        const result = request.cardId === null
          ? await this.startScript.execute(
              request.scriptId,
              request.operationId,
              request.localPrepared,
            )
          : await this.startCard.execute({
              scriptId: request.scriptId,
              cardId: request.cardId,
              replaceManual: request.replaceManual,
              operationId: request.operationId,
              localPrepared: request.localPrepared,
            })
        this.events.accepted(request.scopeKey, result)
        this.trackResult(request.scopeKey, result)
      } catch {
        // The durable row remains available for the next connectivity/auth retry.
      }
    }))
  }

  private trackResult(scopeKey: string, result: StartGenerationResult): void {
    if (result.state === 'tracking') this.track(scopeKey, result.generation.id)
  }

  private track(scopeKey: string, generationId: UUID): void {
    if (this.active.has(generationId)) return
    this.active.add(generationId)
    this.refresh.track(
      generationId,
      (generation) => {
        this.events.updated(scopeKey, generation)
        if (generation.status === 'completed' || generation.status === 'failed') {
          this.active.delete(generationId)
        }
      },
      (error) => {
        this.events.failed(scopeKey, error)
        if (error instanceof ApiError && error.status === 401) {
          this.active.delete(generationId)
        }
      },
    )
  }
}
