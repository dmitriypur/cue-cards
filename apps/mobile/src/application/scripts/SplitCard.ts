import { v7 as uuidv7 } from 'uuid'

import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { Clock, SaveScriptInput } from '@/application/scripts/SaveScriptAggregate'
import { sha256 } from '@/domain/scripts/contentHash'
import { reconcileCueState } from '@/domain/scripts/cueState'
import type { ScriptAggregate, ScriptCard, UUID } from '@/domain/scripts/types'

interface AggregateSaver {
  execute(input: SaveScriptInput): Promise<ScriptAggregate>
}

export interface SplitCardInput {
  readonly scriptId: UUID
  readonly cardId: UUID
  readonly offset: number
  readonly nextTitle: string
}

export class SplitCard {
  private readonly scripts: ScriptRepository
  private readonly saver: AggregateSaver
  private readonly clock: Clock
  private readonly createId: () => UUID

  public constructor(
    scripts: ScriptRepository,
    saver: AggregateSaver,
    clock: Clock,
    createId: () => UUID = uuidv7,
  ) {
    this.scripts = scripts
    this.saver = saver
    this.clock = clock
    this.createId = createId
  }

  public async execute(input: SplitCardInput): Promise<ScriptAggregate> {
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
    const codePoints = Array.from(current.fullText)
    const firstText = codePoints.slice(0, input.offset).join('').trim()
    const nextText = codePoints.slice(input.offset).join('').trim()
    const nextTitle = input.nextTitle.trim()
    if (firstText === '' || nextText === '' || nextTitle === '') {
      throw new Error('Split must create two non-empty cards')
    }

    const updatedAt = this.clock.now()
    const firstHash = await sha256(firstText)
    const nextHash = await sha256(nextText)
    const nextCardId = this.createId()
    const nextCueSetId = this.createId()
    const firstCard: ScriptCard = {
      ...current,
      fullText: firstText,
      contentHash: firstHash,
      cueSet: reconcileCueState(current.cueSet, firstHash),
      updatedAt,
    }
    const nextCard: ScriptCard = {
      id: nextCardId,
      scriptId: aggregate.id,
      position: current.position + 1,
      title: nextTitle,
      fullText: nextText,
      contentHash: nextHash,
      version: 0,
      cueSet: {
        id: nextCueSetId,
        cardId: nextCardId,
        cues: [],
        sourceHash: null,
        status: 'missing',
        generationId: null,
        manuallyEdited: false,
        version: 0,
        createdAt: updatedAt,
        updatedAt,
      },
      createdAt: updatedAt,
      updatedAt,
      deletedAt: null,
    }
    const cards = [
      ...aggregate.cards.slice(0, cardIndex),
      firstCard,
      nextCard,
      ...aggregate.cards.slice(cardIndex + 1).map((card) => ({
        ...card,
        position: card.position + 1,
        updatedAt,
      })),
    ]

    return this.saver.execute({
      aggregate: { ...aggregate, cards, syncStatus: 'pending', updatedAt },
    })
  }
}
