import { beforeEach, describe, expect, it, vi } from 'vitest'

const { addListener } = vi.hoisted(() => ({ addListener: vi.fn() }))

vi.mock('@capacitor/app', () => ({ App: { addListener } }))

import {
  registerAppBackgroundListener,
  registerAppStateListener,
} from '@/infrastructure/capacitor/CapacitorAppBackground'

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

describe('registerAppStateListener', () => {
  it('reports both background and resume state changes', async () => {
    let nativeListener: ((state: { isActive: boolean }) => void) | null = null
    addListener.mockImplementation((_event, listener) => {
      nativeListener = listener
      return Promise.resolve({ remove: vi.fn().mockResolvedValue(undefined) })
    })
    const states: boolean[] = []

    registerAppStateListener((isActive) => { states.push(isActive) })
    const notify = nativeListener as ((state: { isActive: boolean }) => void) | null
    notify?.({ isActive: false })
    notify?.({ isActive: true })

    expect(states).toEqual([false, true])
  })
})
