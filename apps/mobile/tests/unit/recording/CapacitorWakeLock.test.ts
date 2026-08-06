import { beforeEach, describe, expect, it, vi } from 'vitest'

const keepAwake = vi.hoisted(() => vi.fn<() => Promise<void>>())
const allowSleep = vi.hoisted(() => vi.fn<() => Promise<void>>())
const isSupported = vi.hoisted(() => vi.fn<() => Promise<{ isSupported: boolean }>>())

vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake, allowSleep, isSupported },
}))

import { CapacitorWakeLock } from '@/infrastructure/capacitor/CapacitorWakeLock'

describe('CapacitorWakeLock', () => {
  beforeEach(() => {
    keepAwake.mockReset().mockResolvedValue(undefined)
    allowSleep.mockReset().mockResolvedValue(undefined)
    isSupported.mockReset().mockResolvedValue({ isSupported: true })
  })

  it('keeps the display awake and allows sleep again', async () => {
    const wakeLock = new CapacitorWakeLock()

    await wakeLock.acquire()
    await wakeLock.release()

    expect(keepAwake).toHaveBeenCalledOnce()
    expect(allowSleep).toHaveBeenCalledOnce()
  })

  it('reports unsupported and failed plugin calls without rejecting recording', async () => {
    const warnings: string[] = []
    isSupported.mockResolvedValueOnce({ isSupported: false })
    const unsupported = new CapacitorWakeLock((message) => warnings.push(message))

    await expect(unsupported.acquire()).resolves.toBeUndefined()
    expect(keepAwake).not.toHaveBeenCalled()

    allowSleep.mockRejectedValueOnce(new Error('native failure'))
    await expect(unsupported.release()).resolves.toBeUndefined()
    expect(warnings).toEqual([
      'Не удалось запретить выключение экрана.',
      'Не удалось разрешить выключение экрана.',
    ])
    expect(unsupported.takeWarning()).toBe('Не удалось разрешить выключение экрана.')
    expect(unsupported.takeWarning()).toBeNull()
  })
})
