import type {
  AiGeneration,
  AiGenerationGateway,
} from '@/application/ports/AiGenerationGateway'
import type { Connectivity } from '@/application/ports/Connectivity'
import type { AiGenerationRequestRepository } from '@/application/ports/AiGenerationRequestRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import {
  markGenerationPending,
  type GenerationAggregateSaver,
  type GenerationStartDependencies,
  type ManualSync,
} from '@/application/ai/generationSupport'
import type { UUID } from '@/domain/scripts/types'

export type StartGenerationResult =
  | { readonly state: 'waiting-for-network'; readonly generation: null }
  | { readonly state: 'auth-required'; readonly generation: null }
  | { readonly state: 'conflict'; readonly generation: null }
  | { readonly state: 'tracking'; readonly generation: AiGeneration }

export class StartScriptCueGeneration {
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

  public async execute(
    scriptId: UUID,
    restoredOperationId?: UUID,
    localPrepared = false,
  ): Promise<StartGenerationResult> {
    const scopeKey = `script:${scriptId}`
    const operationId = restoredOperationId ?? this.createOperationId()
    if (restoredOperationId === undefined) {
      await this.requests.upsertPending({
        scopeKey,
        scriptId,
        cardId: null,
        operationId,
        localPrepared: false,
        replaceManual: false,
        generationId: null,
        createdAt: this.now(),
      })
    }
    if (!localPrepared) {
      await markGenerationPending(this.dependencies, scriptId, null)
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
    const generation = await this.gateway.startScript(scriptId, operationId)
    await this.requests.markStarted(scopeKey, generation.id)
    return { state: 'tracking', generation }
  }
}
