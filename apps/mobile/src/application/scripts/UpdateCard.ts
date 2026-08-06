import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { Clock, SaveScriptInput } from '@/application/scripts/SaveScriptAggregate'
import { sha256 } from '@/domain/scripts/contentHash'
import { reconcileCueState } from '@/domain/scripts/cueState'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

interface AggregateSaver {
  execute(input: SaveScriptInput): Promise<ScriptAggregate>
}

export interface UpdateCardInput {
  readonly scriptId: UUID
  readonly cardId: UUID
  readonly title: string
  readonly fullText: string
}

export class UpdateCard {
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

  public async execute(input: UpdateCardInput): Promise<ScriptAggregate> {
    const aggregate = await this.scripts.get(input.scriptId)
    if (aggregate === null || aggregate.deletedAt !== null) {
      throw new Error('Script not found')
    }

    const title = input.title.trim()
    if (title === '' || input.fullText.trim() === '') {
      throw new Error('Card title and text are required')
    }

    const cardIndex = aggregate.cards.findIndex(({ id, deletedAt }) => (
      id === input.cardId && deletedAt === null
    ))
    if (cardIndex < 0) {
      throw new Error('Card not found')
    }

    const current = aggregate.cards[cardIndex]!
    const contentHash = await sha256(input.fullText)
    const updatedAt = this.clock.now()
    const cards = aggregate.cards.slice()
    cards[cardIndex] = {
      ...current,
      title,
      fullText: input.fullText,
      contentHash,
      cueSet: reconcileCueState(current.cueSet, contentHash),
      updatedAt,
    }

    return this.saver.execute({
      aggregate: {
        ...aggregate,
        cards,
        syncStatus: 'pending',
        updatedAt,
      },
    })
  }
}
