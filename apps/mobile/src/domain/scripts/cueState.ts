import type { CueSet } from '@/domain/scripts/types'

export function reconcileCueState(cueSet: CueSet, nextHash: string): CueSet {
  if (cueSet.sourceHash === nextHash || cueSet.cues.length === 0) {
    return cueSet
  }

  return {
    ...cueSet,
    status: 'stale',
  }
}
