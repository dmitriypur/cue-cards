import { beforeEach, describe, expect, it, vi } from 'vitest'

const { addListener } = vi.hoisted(() => ({ addListener: vi.fn() }))

vi.mock('@capacitor/app', () => ({ App: { addListener } }))

import { registerAppBackgroundListener } from '@/infrastructure/capacitor/CapacitorAppBackground'

describe('registerAppBackgroundListener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes a registered native listener during cleanup', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    addListener.mockResolvedValue({ remove })

    const unsubscribe = registerAppBackgroundListener(vi.fn())
    await Promise.resolve()
    unsubscribe()

    expect(remove).toHaveBeenCalledOnce()
  })

  it('removes a listener that finishes registering after cleanup', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    let resolveRegistration: ((handle: { remove(): Promise<void> }) => void) | null = null
    addListener.mockReturnValue(new Promise((resolve) => { resolveRegistration = resolve }))

    const unsubscribe = registerAppBackgroundListener(vi.fn())
    unsubscribe()
    const resolve = resolveRegistration as ((handle: { remove(): Promise<void> }) => void) | null
    resolve?.({ remove })
    await Promise.resolve()

    expect(remove).toHaveBeenCalledOnce()
  })
})
