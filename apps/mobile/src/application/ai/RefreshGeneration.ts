import type {
  AiGeneration,
  AiGenerationGateway,
} from '@/application/ports/AiGenerationGateway'
import { ApiError } from '@/application/ports/ApiClient'
import type { ManualSync } from '@/application/ai/generationSupport'
import type { AiGenerationRequestRepository } from '@/application/ports/AiGenerationRequestRepository'
import type { UUID } from '@/domain/scripts/types'

type PollScheduler = (work: () => void, delayMs: number) => unknown
type PollCanceller = (handle: unknown) => void

interface ActivePoll {
  readonly generationId: UUID
  readonly listeners: Set<(generation: AiGeneration) => void>
  readonly errorListeners: Set<(error: unknown) => void>
  attempt: number
  handle: unknown | null
}

const pollDelays = [2_000, 5_000, 10_000] as const

export class RefreshGeneration {
  private readonly gateway: AiGenerationGateway
  private readonly sync: ManualSync
  private readonly requests: AiGenerationRequestRepository
  private readonly schedule: PollScheduler
  private readonly cancelSchedule: PollCanceller
  private readonly active = new Map<UUID, ActivePoll>()

  public constructor(
    gateway: AiGenerationGateway,
    sync: ManualSync,
    requests: AiGenerationRequestRepository,
    schedule: PollScheduler = (work, delayMs) => globalThis.setTimeout(work, delayMs),
    cancelSchedule: PollCanceller = (handle) => globalThis.clearTimeout(handle as number),
  ) {
    this.gateway = gateway
    this.sync = sync
    this.requests = requests
    this.schedule = schedule
    this.cancelSchedule = cancelSchedule
  }

  public async execute(generationId: UUID): Promise<AiGeneration> {
    const generation = await this.gateway.get(generationId)
    if (generation.status === 'completed' || generation.status === 'failed') {
      const result = await this.sync.execute('manual')
      if (result.state === 'up-to-date') {
        await this.requests.removeByGeneration(generationId)
      }
    }
    return generation
  }

  public track(
    generationId: UUID,
    listener: (generation: AiGeneration) => void,
    onError: (error: unknown) => void = () => undefined,
  ): () => void {
    let poll = this.active.get(generationId)
    if (poll === undefined) {
      poll = {
        generationId,
        listeners: new Set(),
        errorListeners: new Set(),
        attempt: 0,
        handle: null,
      }
      this.active.set(generationId, poll)
      this.scheduleNext(poll)
    }
    poll.listeners.add(listener)
    poll.errorListeners.add(onError)

    return () => {
      poll?.listeners.delete(listener)
      poll?.errorListeners.delete(onError)
      if (poll !== undefined && poll.listeners.size === 0) this.stop(poll)
    }
  }

  private scheduleNext(poll: ActivePoll): void {
    const index = Math.min(poll.attempt, pollDelays.length - 1)
    const delay = pollDelays[index] ?? 10_000
    poll.handle = this.schedule(() => {
      poll.handle = null
      void this.poll(poll)
    }, delay)
  }

  private async poll(poll: ActivePoll): Promise<void> {
    if (this.active.get(poll.generationId) !== poll) return
    try {
      const generation = await this.execute(poll.generationId)
      for (const listener of poll.listeners) listener(generation)
      if (generation.status === 'completed' || generation.status === 'failed') {
        this.stop(poll)
        return
      }
    } catch (error: unknown) {
      for (const listener of poll.errorListeners) listener(error)
      if (error instanceof ApiError && error.status === 401) {
        this.stop(poll)
        return
      }
    }

    if (this.active.get(poll.generationId) !== poll) return
    poll.attempt += 1
    this.scheduleNext(poll)
  }

  private stop(poll: ActivePoll): void {
    if (poll.handle !== null) this.cancelSchedule(poll.handle)
    poll.handle = null
    if (this.active.get(poll.generationId) === poll) this.active.delete(poll.generationId)
  }
}
