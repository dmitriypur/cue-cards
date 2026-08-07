import type {
  OutboxCommand,
  OutboxRepository,
  StoredOutboxCommand,
} from '@/application/ports/OutboxRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { UUID } from '@/domain/scripts/types'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

const STORAGE_KEY = 'cue_cards.e2e.outbox'

export class BrowserOutboxRepository implements OutboxRepository {
  private readonly scripts: ScriptRepository

  public constructor(scripts: ScriptRepository) { this.scripts = scripts }

  public async upsertLatestSnapshot(command: OutboxCommand, _tx?: SqlTransaction): Promise<void> {
    const commands = this.readAll()
    const existing = commands.findIndex(({ aggregateId, state }) => (
      aggregateId === command.aggregateId && state === 'pending'
    ))
    const stored: StoredOutboxCommand = { ...command, state: 'pending', attempts: 0, nextAttemptAt: null }
    if (existing === -1) commands.push(stored)
    else commands[existing] = { ...stored, operationId: commands[existing]?.operationId ?? command.operationId }
    this.writeAll(commands)
  }

  public async next(includeDeferred = false): Promise<StoredOutboxCommand | null> {
    const now = new Date().toISOString()
    return this.readAll().find(({ state, nextAttemptAt }) => (
      state === 'pending' && (includeDeferred || nextAttemptAt === null || nextAttemptAt <= now)
    )) ?? null
  }

  public async nextRetryAt(): Promise<string | null> {
    return this.readAll().map(({ nextAttemptAt }) => nextAttemptAt).filter((value): value is string => value !== null).sort()[0] ?? null
  }

  public async find(operationId: UUID): Promise<StoredOutboxCommand | null> {
    return this.readAll().find((command) => command.operationId === operationId) ?? null
  }

  public async hasForAggregate(aggregateId: UUID, _tx?: SqlTransaction): Promise<boolean> {
    return this.readAll().some((command) => command.aggregateId === aggregateId)
  }

  public async recoverInterrupted(): Promise<void> {
    this.updateAll((command) => command.state === 'in_flight' ? { ...command, state: 'pending' } : command)
  }

  public async markInFlight(operationId: UUID): Promise<void> {
    this.update(operationId, (command) => ({ ...command, state: 'in_flight' }))
  }

  public async release(operationId: UUID): Promise<void> {
    this.update(operationId, (command) => ({ ...command, state: 'pending' }))
  }

  public async scheduleRetry(operationId: UUID, nextAttemptAt: string): Promise<void> {
    this.update(operationId, (command) => ({ ...command, state: 'pending', attempts: command.attempts + 1, nextAttemptAt }))
  }

  public async removeForAggregate(aggregateId: UUID, _tx?: SqlTransaction): Promise<void> {
    this.writeAll(this.readAll().filter((command) => command.aggregateId !== aggregateId))
  }

  public async acknowledge(operationId: UUID, serverVersion: number): Promise<void> {
    const commands = this.readAll()
    const accepted = commands.find((command) => command.operationId === operationId)
    if (accepted === undefined) return
    const remaining = commands
      .filter((command) => command.operationId !== operationId)
      .map((command) => command.aggregateId === accepted.aggregateId && command.state === 'pending'
        ? { ...command, baseVersion: serverVersion }
        : command)
    this.writeAll(remaining)
    const script = await this.scripts.get(accepted.aggregateId)
    if (script !== null) {
      await this.scripts.save({
        ...script,
        serverVersion,
        syncStatus: remaining.some(({ aggregateId }) => aggregateId === accepted.aggregateId)
          ? 'pending'
          : 'synced',
      })
    }
  }

  public async rebasePending(aggregateId: UUID, serverVersion: number, _tx?: SqlTransaction): Promise<void> {
    this.updateAll((command) => command.aggregateId === aggregateId && command.state === 'pending'
      ? { ...command, baseVersion: serverVersion }
      : command)
  }

  private readAll(): StoredOutboxCommand[] {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return []
    const value: unknown = JSON.parse(stored)
    return Array.isArray(value) ? value as StoredOutboxCommand[] : []
  }

  private writeAll(commands: readonly StoredOutboxCommand[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(commands))
  }

  private update(operationId: UUID, change: (command: StoredOutboxCommand) => StoredOutboxCommand): void {
    this.updateAll((command) => command.operationId === operationId ? change(command) : command)
  }

  private updateAll(change: (command: StoredOutboxCommand) => StoredOutboxCommand): void {
    this.writeAll(this.readAll().map(change))
  }
}
