import { describe, expect, it } from 'vitest'

import { sha256 } from '@/domain/scripts/contentHash'
import { reconcileCueState } from '@/domain/scripts/cueState'
import type { CueSet } from '@/domain/scripts/types'

const readyCueSet: CueSet = {
  id: '019b9ccb-3f71-7000-8000-000000000001',
  cardId: '019b9ccb-3f71-7000-8000-000000000002',
  cues: ['Начать с проблемы', 'Показать решение', 'Подвести итог'],
  sourceHash: 'current-hash',
  status: 'ready',
  generationId: '019b9ccb-3f71-7000-8000-000000000003',
  manuallyEdited: false,
  version: 1,
  createdAt: '2026-08-06T06:00:00.000Z',
  updatedAt: '2026-08-06T06:00:00.000Z',
}

describe('reconcileCueState', () => {
  it('keeps a ready cue set when its source hash is current', () => {
    expect(reconcileCueState(readyCueSet, 'current-hash')).toEqual(readyCueSet)
  })

  it('retains cues and marks them stale when the source hash changes', () => {
    expect(reconcileCueState(readyCueSet, 'next-hash')).toEqual({
      ...readyCueSet,
      status: 'stale',
    })
  })

  it('never clears manually edited cues when the source hash changes', () => {
    const manualCueSet: CueSet = {
      ...readyCueSet,
      cues: ['Ручной тезис 1', 'Ручной тезис 2', 'Ручной тезис 3'],
      manuallyEdited: true,
    }

    const reconciled = reconcileCueState(manualCueSet, 'next-hash')

    expect(reconciled.cues).toEqual(manualCueSet.cues)
    expect(reconciled.status).toBe('stale')
    expect(reconciled.manuallyEdited).toBe(true)
  })
})

describe('sha256', () => {
  it('hashes UTF-8 Cyrillic text to a lowercase hexadecimal digest', async () => {
    await expect(sha256('Привет')).resolves.toBe(
      'dd679c0b9fd408a04148aa7d30c9df393f67b7227f65693fffe0ed6d0f0ade59',
    )
  })
})
