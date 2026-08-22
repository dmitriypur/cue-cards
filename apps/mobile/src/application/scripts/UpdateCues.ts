import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { Clock, SaveScriptInput } from '@/application/scripts/SaveScriptAggregate'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

interface AggregateSaver {
  execute(input: SaveScriptInput): Promise<ScriptAggregate>
}

export interface UpdateCuesInput {
  readonly scriptId: UUID
  readonly cardId: UUID
  readonly cues: readonly string[]
}

export class UpdateCues {
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

  public async execute(input: UpdateCuesInput): Promise<ScriptAggregate> {
    const cues = input.cues.map((cue) => cue.trim())
    const uniqueCues = new Set(cues)
    if (
      cues.length === 0
      || cues.some((cue) => cue === '' || [...cue].length > 200)
      || uniqueCues.size !== cues.length
    ) {
      throw new Error('Cues must contain unique non-empty strings up to 200 characters')
    }

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

    const updatedAt = this.clock.now()
    const cards = aggregate.cards.slice()
    const current = cards[cardIndex]!
    cards[cardIndex] = {
      ...current,
      cueSet: {
        ...current.cueSet,
        cues,
        sourceHash: current.contentHash,
        status: 'ready',
        manuallyEdited: true,
        version: current.cueSet.version + 1,
        updatedAt,
      },
      updatedAt,
    }

    return this.saver.execute({
      aggregate: { ...aggregate, cards, syncStatus: 'pending', updatedAt },
    })
  }
}
