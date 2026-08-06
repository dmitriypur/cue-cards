import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { Clock, SaveScriptInput } from '@/application/scripts/SaveScriptAggregate'
import { sha256 } from '@/domain/scripts/contentHash'
import { reconcileCueState } from '@/domain/scripts/cueState'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

interface AggregateSaver {
  execute(input: SaveScriptInput): Promise<ScriptAggregate>
}

export interface MergeCardsInput {
  readonly scriptId: UUID
  readonly cardId: UUID
}

export class MergeCards {
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

  public async execute(input: MergeCardsInput): Promise<ScriptAggregate> {
    const aggregate = await this.scripts.get(input.scriptId)
    if (aggregate === null || aggregate.deletedAt !== null) {
      throw new Error('Script not found')
    }

    const cardIndex = aggregate.cards.findIndex(({ id, deletedAt }) => (
      id === input.cardId && deletedAt === null
    ))
    if (cardIndex < 0) {
      throw new Error('Card not found')
    }

    const current = aggregate.cards[cardIndex]!
    const next = aggregate.cards.slice(cardIndex + 1).find(({ deletedAt }) => deletedAt === null)
    if (next === undefined) {
      throw new Error('Last card cannot be merged')
    }

    const fullText = `${current.fullText.trimEnd()}\n\n${next.fullText.trimStart()}`
    const contentHash = await sha256(fullText)
    const updatedAt = this.clock.now()
    const cards = aggregate.cards
      .filter(({ id }) => id !== next.id)
      .map((card, position) => card.id === current.id
        ? {
            ...card,
            position,
            fullText,
            contentHash,
            cueSet: reconcileCueState(card.cueSet, contentHash),
            updatedAt,
          }
        : { ...card, position, updatedAt })

    return this.saver.execute({
      aggregate: { ...aggregate, cards, syncStatus: 'pending', updatedAt },
    })
  }
}
