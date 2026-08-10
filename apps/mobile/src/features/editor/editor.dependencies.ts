import type { InjectionKey } from 'vue'

import type { MergeCards, MergeCardsInput } from '@/application/scripts/MergeCards'
import type { ReorderCards, ReorderCardsInput } from '@/application/scripts/ReorderCards'
import type { SplitCard, SplitCardInput } from '@/application/scripts/SplitCard'
import type { UpdateCard, UpdateCardInput } from '@/application/scripts/UpdateCard'
import type { UpdateCues, UpdateCuesInput } from '@/application/scripts/UpdateCues'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

export interface ScriptLoader {
  execute(scriptId: UUID): Promise<ScriptAggregate>
}

export interface EditorDependencies {
  readonly getScript: ScriptLoader
  readonly readScript: ScriptLoader
  readonly updateCard: Pick<UpdateCard, 'execute'> & { execute(input: UpdateCardInput): Promise<ScriptAggregate> }
  readonly reorderCards: Pick<ReorderCards, 'execute'> & { execute(input: ReorderCardsInput): Promise<ScriptAggregate> }
  readonly splitCard: Pick<SplitCard, 'execute'> & { execute(input: SplitCardInput): Promise<ScriptAggregate> }
  readonly mergeCards: Pick<MergeCards, 'execute'> & { execute(input: MergeCardsInput): Promise<ScriptAggregate> }
  readonly updateCues: Pick<UpdateCues, 'execute'> & { execute(input: UpdateCuesInput): Promise<ScriptAggregate> }
  onAppBackground(listener: () => void | Promise<void>): () => void
}

export const editorDependenciesKey: InjectionKey<EditorDependencies> = Symbol('editor-dependencies')
