import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { Clock } from '@/application/scripts/SaveScriptAggregate'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

interface AggregateSaver {
  execute(input: { readonly aggregate: ScriptAggregate }): Promise<ScriptAggregate>
}

const systemClock: Clock = {
  now: () => new Date().toISOString(),
}

export class GetScript {
  private readonly scripts: ScriptRepository
  private readonly saveAggregate: AggregateSaver
  private readonly clock: Clock

  public constructor(
    scripts: ScriptRepository,
    saveAggregate: AggregateSaver,
    clock: Clock = systemClock,
  ) {
    this.scripts = scripts
    this.saveAggregate = saveAggregate
    this.clock = clock
  }

  public async execute(scriptId: UUID): Promise<ScriptAggregate> {
    const aggregate = await this.scripts.get(scriptId)
    if (aggregate === null || aggregate.deletedAt !== null) {
      throw new Error('Script not found')
    }

    const openedAt = this.clock.now()
    return this.saveAggregate.execute({
      aggregate: {
        ...aggregate,
        lastOpenedAt: openedAt,
        updatedAt: openedAt,
        syncStatus: 'pending',
      },
    })
  }
}
