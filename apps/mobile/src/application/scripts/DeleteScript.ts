import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { Clock } from '@/application/scripts/SaveScriptAggregate'
import type { SaveScriptAggregate } from '@/application/scripts/SaveScriptAggregate'
import type { UUID } from '@/domain/scripts/types'

const systemClock: Clock = {
  now: () => new Date().toISOString(),
}

export class DeleteScript {
  private readonly scripts: ScriptRepository
  private readonly saveAggregate: Pick<SaveScriptAggregate, 'execute'>
  private readonly clock: Clock

  public constructor(
    scripts: ScriptRepository,
    saveAggregate: Pick<SaveScriptAggregate, 'execute'>,
    clock: Clock = systemClock,
  ) {
    this.scripts = scripts
    this.saveAggregate = saveAggregate
    this.clock = clock
  }

  public async execute(scriptId: UUID): Promise<void> {
    const aggregate = await this.scripts.get(scriptId)
    if (aggregate === null || aggregate.deletedAt !== null) {
      throw new Error('Script not found')
    }

    const deletedAt = this.clock.now()
    await this.saveAggregate.execute({
      aggregate: {
        ...aggregate,
        syncStatus: 'pending',
        updatedAt: deletedAt,
        deletedAt,
      },
    })
  }

  public async undo(scriptId: UUID): Promise<void> {
    const aggregate = await this.scripts.get(scriptId)
    if (aggregate === null || aggregate.deletedAt === null) {
      throw new Error('Deleted script not found')
    }

    const restoredAt = this.clock.now()
    await this.saveAggregate.execute({
      aggregate: {
        ...aggregate,
        syncStatus: 'pending',
        updatedAt: restoredAt,
        deletedAt: null,
      },
    })
  }
}
