import type { ConflictRepository } from '@/application/ports/ConflictRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import { SyncConflictError } from '@/application/ports/SyncGateway'
import type { Clock } from '@/application/scripts/SaveScriptAggregate'
import type { UUID } from '@/domain/scripts/types'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'

export class RecordSyncConflict {
  private readonly conflicts: ConflictRepository
  private readonly scripts: ScriptRepository
  private readonly unitOfWork: LocalUnitOfWork
  private readonly createId: () => UUID
  private readonly clock: Clock

  public constructor(
    conflicts: ConflictRepository,
    scripts: ScriptRepository,
    unitOfWork: LocalUnitOfWork,
    createId: () => UUID,
    clock: Clock,
  ) {
    this.conflicts = conflicts
    this.scripts = scripts
    this.unitOfWork = unitOfWork
    this.createId = createId
    this.clock = clock
  }

  public execute(operationId: UUID, error: SyncConflictError): Promise<void> {
    return this.unitOfWork.run(async (tx) => {
      const currentLocal = await this.scripts.get(error.aggregateId, tx)
      await this.conflicts.save({
        id: this.createId(),
        aggregateId: error.aggregateId,
        operationId,
        local: { ...(currentLocal ?? error.local), syncStatus: 'conflict' },
        server: { ...error.server, syncStatus: 'synced' },
        createdAt: this.clock.now(),
      }, tx)
    })
  }

  public async hasAny(): Promise<boolean> {
    return (await this.conflicts.list()).length > 0
  }
}
