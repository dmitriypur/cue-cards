import type { Connectivity } from '@/application/ports/Connectivity'
import { ApiError } from '@/application/ports/ApiClient'
import type { OutboxRepository } from '@/application/ports/OutboxRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import { SyncConflictError, type SyncGateway } from '@/application/ports/SyncGateway'
import type { SyncStateRepository } from '@/application/ports/SyncStateRepository'
import type { ApplyRemoteChanges } from '@/application/sync/ApplyRemoteChanges'
import type { RecordSyncConflict } from '@/application/sync/RecordSyncConflict'

export type SyncReason = 'startup' | 'connectivity' | 'manual'
export type SyncRunState =
  | 'offline'
  | 'syncing'
  | 'up-to-date'
  | 'retrying'
  | 'auth-required'
  | 'conflict'

export interface SyncResult {
  readonly state: SyncRunState
  readonly uploaded: number
  readonly downloaded: number
}

const retrySeconds = [2, 5, 15, 30, 60] as const

export class RunSync {
  private static running: Promise<SyncResult> | null = null
  private static requestedReason: SyncReason | null = null
  private readonly connectivity: Connectivity
  private readonly gateway: SyncGateway
  private readonly scripts: ScriptRepository
  private readonly outbox: OutboxRepository
  private readonly syncState: SyncStateRepository
  private readonly applyRemoteChanges: Pick<ApplyRemoteChanges, 'execute'>
  private readonly recordConflict: Pick<RecordSyncConflict, 'execute' | 'hasAny'>
  private readonly now: () => Date
  private readonly jitter: () => number
  private readonly schedule: (work: () => void, delayMs: number) => unknown
  private readonly cancelSchedule: (handle: unknown) => void
  private scheduledRetry: { readonly deadline: number; readonly handle: unknown } | null = null
  private downloadAttempts = 0

  public constructor(
    connectivity: Connectivity,
    gateway: SyncGateway,
    scripts: ScriptRepository,
    outbox: OutboxRepository,
    syncState: SyncStateRepository,
    applyRemoteChanges: Pick<ApplyRemoteChanges, 'execute'>,
    recordConflict: Pick<RecordSyncConflict, 'execute' | 'hasAny'>,
    now: () => Date = () => new Date(),
    jitter: () => number = Math.random,
    schedule: (work: () => void, delayMs: number) => unknown = (work, delayMs) => {
      return globalThis.setTimeout(work, delayMs)
    },
    cancelSchedule: (handle: unknown) => void = (handle) => {
      globalThis.clearTimeout(handle as number)
    },
  ) {
    this.connectivity = connectivity
    this.gateway = gateway
    this.scripts = scripts
    this.outbox = outbox
    this.syncState = syncState
    this.applyRemoteChanges = applyRemoteChanges
    this.recordConflict = recordConflict
    this.now = now
    this.jitter = jitter
    this.schedule = schedule
    this.cancelSchedule = cancelSchedule
  }

  public execute(reason: SyncReason): Promise<SyncResult> {
    if (reason === 'manual') this.clearScheduledRetry()
    RunSync.requestedReason = this.preferReason(RunSync.requestedReason, reason)
    if (RunSync.running !== null) return RunSync.running

    const run = this.drainRequestedRuns().finally(() => {
      if (RunSync.running === run) RunSync.running = null
    })
    RunSync.running = run
    return run
  }

  private async drainRequestedRuns(): Promise<SyncResult> {
    let final: SyncResult = { state: 'up-to-date', uploaded: 0, downloaded: 0 }

    while (RunSync.requestedReason !== null) {
      const reason = RunSync.requestedReason
      RunSync.requestedReason = null
      const result = await this.run(reason)
      final = {
        state: result.state,
        uploaded: final.uploaded + result.uploaded,
        downloaded: final.downloaded + result.downloaded,
      }

      if (
        RunSync.requestedReason !== null
        && (result.state === 'auth-required' || result.state === 'conflict')
        && RunSync.requestedReason !== 'manual'
      ) {
        RunSync.requestedReason = null
      }
    }

    return final
  }

  private async run(reason: SyncReason): Promise<SyncResult> {
    void this.scripts
    if (!await this.connectivity.current()) {
      return { state: 'offline', uploaded: 0, downloaded: 0 }
    }
    if (await this.recordConflict.hasAny()) {
      return { state: 'conflict', uploaded: 0, downloaded: 0 }
    }
    await this.outbox.recoverInterrupted()

    let uploaded = 0
    while (true) {
      const command = await this.outbox.next(reason === 'manual')
      if (command === null) break

      await this.outbox.markInFlight(command.operationId)
      try {
        const response = await this.gateway.submit([command])
        const accepted = response.results.find(
          ({ operationId }) => operationId === command.operationId,
        )
        if (accepted === undefined) throw new Error('Sync response omitted the submitted operation')
        await this.outbox.acknowledge(command.operationId, accepted.version)
        uploaded += 1
      } catch (error: unknown) {
        if (error instanceof SyncConflictError) {
          await this.recordConflict.execute(command.operationId, error)
          return { state: 'conflict', uploaded, downloaded: 0 }
        }
        if (error instanceof ApiError && error.status === 401) {
          await this.outbox.release(command.operationId)
          return { state: 'auth-required', uploaded, downloaded: 0 }
        }
        const retry = this.retryForAttempt(command.attempts)
        await this.outbox.scheduleRetry(command.operationId, retry.at)
        this.scheduleRun(retry.delayMs)
        return { state: 'retrying', uploaded, downloaded: 0 }
      }
    }

    let deferredRetryDelay: number | null = null
    if (reason !== 'manual') {
      const retryAt = await this.outbox.nextRetryAt()
      if (retryAt !== null) {
        deferredRetryDelay = Math.max(0, new Date(retryAt).getTime() - this.now().getTime())
        this.scheduleRun(deferredRetryDelay)
      }
    }

    let cursor = await this.syncState.cursor()
    let downloaded = 0
    try {
      do {
        const page = await this.gateway.changes(cursor)
        downloaded += page.changes.length
        cursor = page.nextCursor
        await this.applyRemoteChanges.execute(page)
        if (!page.hasMore) break
      } while (true)
      this.downloadAttempts = 0
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        return { state: 'auth-required', uploaded, downloaded }
      }
      const retry = this.retryForAttempt(this.downloadAttempts)
      this.downloadAttempts += 1
      this.scheduleRun(retry.delayMs)
      return { state: 'retrying', uploaded, downloaded }
    }

    const state = deferredRetryDelay === null ? 'up-to-date' : 'retrying'
    if (state === 'up-to-date') this.clearScheduledRetry()
    return {
      state,
      uploaded,
      downloaded,
    }
  }

  private retryForAttempt(attempt: number): { readonly at: string; readonly delayMs: number } {
    const index = Math.min(attempt, retrySeconds.length - 1)
    const base = retrySeconds[index] ?? 60
    const jitterMultiplier = 0.8 + Math.min(1, Math.max(0, this.jitter())) * 0.4
    const delayMs = base * jitterMultiplier * 1_000
    return { at: new Date(this.now().getTime() + delayMs).toISOString(), delayMs }
  }

  private preferReason(current: SyncReason | null, incoming: SyncReason): SyncReason {
    if (current === 'manual' || incoming === 'manual') return 'manual'
    if (current === 'connectivity' || incoming === 'connectivity') return 'connectivity'
    return 'startup'
  }

  private scheduleRun(delayMs: number): void {
    const deadline = this.now().getTime() + delayMs
    if (this.scheduledRetry !== null && this.scheduledRetry.deadline <= deadline) return
    this.clearScheduledRetry()
    const handle = this.schedule(() => {
      if (this.scheduledRetry?.deadline === deadline) this.scheduledRetry = null
      void this.execute('connectivity')
    }, delayMs)
    this.scheduledRetry = { deadline, handle }
  }

  private clearScheduledRetry(): void {
    if (this.scheduledRetry === null) return
    this.cancelSchedule(this.scheduledRetry.handle)
    this.scheduledRetry = null
  }
}
