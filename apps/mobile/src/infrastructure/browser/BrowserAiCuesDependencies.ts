import type { StartGenerationResult } from '@/application/ai/StartScriptCueGeneration'
import type { AiGeneration } from '@/application/ports/AiGenerationGateway'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { SaveScriptAggregate } from '@/application/scripts/SaveScriptAggregate'
import type { UUID } from '@/domain/scripts/types'
import type { AiCuesDependencies } from '@/features/ai-cues/aiCues.dependencies'

export class BrowserAiCuesDependencies implements AiCuesDependencies {
  private readonly generations = new Map<UUID, AiGeneration>()
  private readonly scripts: ScriptRepository
  private readonly saver: Pick<SaveScriptAggregate, 'execute'>
  private readonly now: () => string
  private readonly createId: () => UUID

  public readonly startScript = {
    execute: async (scriptId: UUID): Promise<StartGenerationResult> => this.generate(scriptId, null),
  }

  public readonly startCard = {
    execute: async (input: { readonly scriptId: UUID; readonly cardId: UUID }): Promise<StartGenerationResult> => (
      this.generate(input.scriptId, input.cardId)
    ),
  }

  public readonly refresh = {
    execute: async (generationId: UUID): Promise<AiGeneration> => {
      const generation = this.generations.get(generationId)
      if (generation === undefined) throw new Error('Synthetic generation was not found.')
      return generation
    },
    track: (
      generationId: UUID,
      listener: (generation: AiGeneration) => void,
      onError: (error: unknown) => void = () => undefined,
    ): (() => void) => {
      let active = true
      queueMicrotask(() => {
        if (!active) return
        const generation = this.generations.get(generationId)
        if (generation === undefined) onError(new Error('Synthetic generation was not found.'))
        else listener(generation)
      })
      return () => { active = false }
    },
  }

  public constructor(
    scripts: ScriptRepository,
    saver: Pick<SaveScriptAggregate, 'execute'>,
    now: () => string,
    createId: () => UUID,
  ) {
    this.scripts = scripts
    this.saver = saver
    this.now = now
    this.createId = createId
  }

  private async generate(scriptId: UUID, cardId: UUID | null): Promise<StartGenerationResult> {
    const script = await this.scripts.get(scriptId)
    if (script === null) throw new Error('Script was not found.')
    const timestamp = this.now()
    const generationId = this.createId()
    const selected = script.cards.filter((card) => card.deletedAt === null && (cardId === null || card.id === cardId))
    await this.saver.execute({
      aggregate: {
        ...script,
        syncStatus: 'pending',
        updatedAt: timestamp,
        cards: script.cards.map((card) => selected.some(({ id }) => id === card.id) ? {
          ...card,
          cueSet: {
            ...card.cueSet,
            cues: [
              'Ключевая мысль',
              'Причина проблемы',
              'Показательный пример',
              'Практический шаг',
              'Короткий вывод',
              'Связный переход',
            ],
            sourceHash: card.contentHash,
            status: 'ready',
            generationId,
            updatedAt: timestamp,
          },
        } : card),
      },
    })
    const generation: AiGeneration = {
      id: generationId,
      scriptId,
      cardId,
      status: 'completed',
      completedCards: selected.length,
      totalCards: selected.length,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.generations.set(generationId, generation)
    return { state: 'tracking', generation }
  }
}
