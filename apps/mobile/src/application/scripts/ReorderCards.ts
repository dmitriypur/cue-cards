import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { Clock, SaveScriptInput } from '@/application/scripts/SaveScriptAggregate'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

interface AggregateSaver {
  execute(input: SaveScriptInput): Promise<ScriptAggregate>
}

export interface ReorderCardsInput {
  readonly scriptId: UUID
  readonly orderedCardIds: readonly UUID[]
}

export class ReorderCards {
  private readonly scripts: ScriptRepository
  private readonly saver: AggregateSaver
  private readonly clock: Clock

  public constructor(
    scripts: ScriptRepository,
    saver: AggregateSaver,
    clock: Clock,
  ) {
    this.scripts = scripts
    this.saver = saver
    this.clock = clock
  }

  public async execute(input: ReorderCardsInput): Promise<ScriptAggregate> {
    const aggregate = await this.scripts.get(input.scriptId)
    if (aggregate === null || aggregate.deletedAt !== null) {
      throw new Error('Script not found')
    }

    const activeCards = aggregate.cards.filter(({ deletedAt }) => deletedAt === null)
    const requestedIds = new Set(input.orderedCardIds)
    if (
      input.orderedCardIds.length !== activeCards.length
      || requestedIds.size !== activeCards.length
      || activeCards.some(({ id }) => !requestedIds.has(id))
    ) {
      throw new Error('Card order must contain every card exactly once')
    }

    const byId = new Map(activeCards.map((card) => [card.id, card]))
    const updatedAt = this.clock.now()
    const cards = input.orderedCardIds.map((id, position) => ({
      ...byId.get(id)!,
      position,
      updatedAt,
    }))

    return this.saver.execute({
      aggregate: { ...aggregate, cards, syncStatus: 'pending', updatedAt },
    })
  }
}
