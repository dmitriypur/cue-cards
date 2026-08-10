import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

export class ReadScript {
  private readonly scripts: ScriptRepository

  public constructor(scripts: ScriptRepository) {
    this.scripts = scripts
  }

  public async execute(scriptId: UUID): Promise<ScriptAggregate> {
    const aggregate = await this.scripts.get(scriptId)
    if (aggregate === null || aggregate.deletedAt !== null) {
      throw new Error('Script not found')
    }
    return aggregate
  }
}
