import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { ScriptSummary } from '@/domain/scripts/types'

function activityTimestamp(script: ScriptSummary): string {
  return script.lastOpenedAt ?? script.updatedAt
}

export class ListScripts {
  private readonly scripts: ScriptRepository

  public constructor(scripts: ScriptRepository) {
    this.scripts = scripts
  }

  public async execute(): Promise<readonly ScriptSummary[]> {
    const scripts = await this.scripts.list()

    return [...scripts].sort((left, right) => {
      const activityOrder = activityTimestamp(right).localeCompare(activityTimestamp(left))
      return activityOrder !== 0
        ? activityOrder
        : right.updatedAt.localeCompare(left.updatedAt)
    })
  }
}
