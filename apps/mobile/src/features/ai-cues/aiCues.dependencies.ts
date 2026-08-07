import type { InjectionKey } from 'vue'

import type { RefreshGeneration } from '@/application/ai/RefreshGeneration'
import type { StartCardCueGeneration } from '@/application/ai/StartCardCueGeneration'
import type { StartScriptCueGeneration } from '@/application/ai/StartScriptCueGeneration'

export interface AiCuesDependencies {
  readonly startScript: Pick<StartScriptCueGeneration, 'execute'>
  readonly startCard: Pick<StartCardCueGeneration, 'execute'>
  readonly refresh: Pick<RefreshGeneration, 'execute' | 'track'>
}

export const aiCuesDependenciesKey: InjectionKey<AiCuesDependencies> = Symbol('ai-cues-dependencies')
