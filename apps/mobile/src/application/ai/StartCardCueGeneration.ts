import type { AiGenerationGateway } from '@/application/ports/AiGenerationGateway'
import type { AiGenerationRequestRepository } from '@/application/ports/AiGenerationRequestRepository'
import type { Connectivity } from '@/application/ports/Connectivity'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import {
  markGenerationPending,
  validateCardGeneration,
  type GenerationAggregateSaver,
  type GenerationStartDependencies,
  type ManualSync,
} from '@/application/ai/generationSupport'
import type { StartGenerationResult } from '@/application/ai/StartScriptCueGeneration'
import type { UUID } from '@/domain/scripts/types'

export interface StartCardCueGenerationInput {
  readonly scriptId: UUID
  readonly cardId: UUID
  readonly replaceManual?: boolean
  readonly operationId?: UUID
  readonly localPrepared?: boolean
}

export class StartCardCueGeneration {
  private readonly dependencies: GenerationStartDependencies
  private readonly gateway: AiGenerationGateway
  private readonly requests: AiGenerationRequestRepository
  private readonly now: () => string
  private readonly createOperationId: () => UUID

  public constructor(
    scripts: ScriptRepository,
    saver: GenerationAggregateSaver,
    connectivity: Pick<Connectivity, 'current'>,
    sync: ManualSync,
    gateway: AiGenerationGateway,
    requests: AiGenerationRequestRepository,
    now: () => string = () => new Date().toISOString(),
    createOperationId: () => UUID = () => globalThis.crypto.randomUUID(),
  ) {
    this.dependencies = { scripts, saver, connectivity, sync }
    this.gateway = gateway
    this.requests = requests
    this.now = now
    this.createOperationId = createOperationId
  }

  public async execute(input: StartCardCueGenerationInput): Promise<StartGenerationResult> {
    const replaceManual = input.replaceManual ?? false
    const operationId = input.operationId ?? this.createOperationId()
    await validateCardGeneration(
      this.dependencies,
      input.scriptId,
      input.cardId,
      replaceManual,
    )
    const scopeKey = `card:${input.cardId}`
    if (input.operationId === undefined) {
      await this.requests.upsertPending({
        scopeKey,
        scriptId: input.scriptId,
        cardId: input.cardId,
        operationId,
        localPrepared: false,
        replaceManual,
        generationId: null,
        createdAt: this.now(),
      })
    }
    if (input.localPrepared !== true) {
      await markGenerationPending(
        this.dependencies,
        input.scriptId,
        input.cardId,
        replaceManual,
      )
      await this.requests.markPrepared(scopeKey)
    }
    if (!await this.dependencies.connectivity.current()) {
      return { state: 'waiting-for-network', generation: null }
    }

    const sync = await this.dependencies.sync.execute('manual')
    if (sync.state === 'auth-required') return { state: 'auth-required', generation: null }
    if (sync.state === 'conflict') return { state: 'conflict', generation: null }
    if (sync.state !== 'up-to-date') {
      return { state: 'waiting-for-network', generation: null }
    }
    const generation = await this.gateway.startCard(input.cardId, replaceManual, operationId)
    await this.requests.markStarted(scopeKey, generation.id)
    return { state: 'tracking', generation }
  }
}
