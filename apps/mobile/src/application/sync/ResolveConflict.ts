import type { ConflictRepository } from '@/application/ports/ConflictRepository'
import type { OutboxRepository } from '@/application/ports/OutboxRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { Clock } from '@/application/scripts/SaveScriptAggregate'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'

export class ResolveConflict {
  private readonly scripts: ScriptRepository
  private readonly outbox: OutboxRepository
  private readonly conflicts: ConflictRepository
  private readonly unitOfWork: LocalUnitOfWork
  private readonly createId: () => UUID
  private readonly clock: Clock

  public constructor(
    scripts: ScriptRepository,
    outbox: OutboxRepository,
    conflicts: ConflictRepository,
    unitOfWork: LocalUnitOfWork,
    createId: () => UUID,
    clock: Clock,
  ) {
    this.scripts = scripts
    this.outbox = outbox
    this.conflicts = conflicts
    this.unitOfWork = unitOfWork
    this.createId = createId
    this.clock = clock
  }

  public useServer(conflictId: UUID): Promise<void> {
    return this.unitOfWork.run(async (tx) => {
      const conflict = await this.conflicts.get(conflictId, tx)
      if (conflict === null) throw new Error('Sync conflict was not found')
      await this.scripts.save({ ...conflict.server, syncStatus: 'synced' }, tx)
      await this.outbox.removeForAggregate(conflict.aggregateId, tx)
      await this.conflicts.remove(conflictId, tx)
    })
  }

  public duplicateLocal(conflictId: UUID): Promise<UUID> {
    return this.unitOfWork.run(async (tx) => {
      const conflict = await this.conflicts.get(conflictId, tx)
      if (conflict === null) throw new Error('Sync conflict was not found')
      const timestamp = this.clock.now()
      const currentLocal = await this.scripts.get(conflict.aggregateId, tx)
      const duplicate = this.duplicate(currentLocal ?? conflict.local, timestamp)
      const operationId = this.createId()

      await this.scripts.save({ ...conflict.server, syncStatus: 'synced' }, tx)
      await this.outbox.removeForAggregate(conflict.aggregateId, tx)
      await this.scripts.save(duplicate, tx)
      await this.outbox.upsertLatestSnapshot({
        operationId,
        aggregateId: duplicate.id,
        baseVersion: 0,
        type: 'script.replace',
        payload: duplicate,
        createdAt: timestamp,
      }, tx)
      await this.conflicts.remove(conflictId, tx)
      return duplicate.id
    })
  }

  private duplicate(local: ScriptAggregate, timestamp: string): ScriptAggregate {
    const scriptId = this.createId()
    return {
      ...local,
      id: scriptId,
      title: `${local.title} (копия)`,
      serverVersion: 0,
      syncStatus: 'pending',
      lastOpenedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      cards: local.cards.filter(({ deletedAt }) => deletedAt === null).map((card, position) => {
        const cardId = this.createId()
        return {
          ...card,
          id: cardId,
          scriptId,
          position,
          version: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          cueSet: {
            ...card.cueSet,
            id: this.createId(),
            cardId,
            version: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        }
      }),
    }
  }
}
