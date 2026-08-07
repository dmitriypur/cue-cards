import type { Connectivity } from '@/application/ports/Connectivity'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { SyncResult } from '@/application/sync/RunSync'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

export interface GenerationAggregateSaver {
  execute(input: { readonly aggregate: ScriptAggregate }): Promise<ScriptAggregate>
}

export interface ManualSync {
  execute(reason: 'manual'): Promise<SyncResult>
}

export interface GenerationStartDependencies {
  readonly scripts: ScriptRepository
  readonly saver: GenerationAggregateSaver
  readonly connectivity: Pick<Connectivity, 'current'>
  readonly sync: ManualSync
}

export async function markGenerationPending(
  dependencies: GenerationStartDependencies,
  scriptId: UUID,
  cardId: UUID | null,
  replaceManual = false,
): Promise<ScriptAggregate> {
  const script = await dependencies.scripts.get(scriptId)
  if (script === null || script.deletedAt !== null) throw new Error('Script not found')
  const selectedCard = cardId === null ? null : script.cards.find(
    ({ id, deletedAt }) => id === cardId && deletedAt === null,
  )
  if (cardId !== null && selectedCard === undefined) throw new Error('Card not found')
  if (selectedCard?.cueSet.manuallyEdited === true && !replaceManual) {
    throw new Error('Manual cues require explicit replacement')
  }

  const next: ScriptAggregate = {
    ...script,
    syncStatus: 'pending',
    cards: script.cards.map((card) => {
      const selected = card.deletedAt === null
        && (cardId === null ? !card.cueSet.manuallyEdited : card.id === cardId)
      if (!selected) return card
      return {
        ...card,
        cueSet: {
          ...card.cueSet,
          status: 'pending',
          generationId: null,
          manuallyEdited: card.cueSet.manuallyEdited,
        },
      }
    }),
  }

  return dependencies.saver.execute({ aggregate: next })
}

export async function validateCardGeneration(
  dependencies: Pick<GenerationStartDependencies, 'scripts'>,
  scriptId: UUID,
  cardId: UUID,
  replaceManual: boolean,
): Promise<void> {
  const script = await dependencies.scripts.get(scriptId)
  if (script === null || script.deletedAt !== null) throw new Error('Script not found')
  const card = script.cards.find(({ id, deletedAt }) => id === cardId && deletedAt === null)
  if (card === undefined) throw new Error('Card not found')
  if (card.cueSet.manuallyEdited && !replaceManual) {
    throw new Error('Manual cues require explicit replacement')
  }
}
