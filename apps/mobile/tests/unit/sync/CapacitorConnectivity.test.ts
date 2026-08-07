import { beforeEach, describe, expect, it, vi } from 'vitest'

const { addListener, getStatus } = vi.hoisted(() => ({
  addListener: vi.fn(),
  getStatus: vi.fn(),
}))

vi.mock('@capacitor/network', () => ({ Network: { addListener, getStatus } }))

import { CapacitorConnectivity } from '@/infrastructure/capacitor/CapacitorConnectivity'

describe('CapacitorConnectivity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the current native connection state', async () => {
    getStatus.mockResolvedValue({ connected: true, connectionType: 'wifi' })

    await expect(new CapacitorConnectivity().current()).resolves.toBe(true)
  })

  it('forwards native changes and removes a registered listener', async () => {
    let notify: ((status: { connected: boolean }) => void) | null = null
    const remove = vi.fn().mockResolvedValue(undefined)
    addListener.mockImplementation((_event, listener) => {
      notify = listener
      return Promise.resolve({ remove })
    })
    const states: boolean[] = []

    const unsubscribe = new CapacitorConnectivity().subscribe((online) => states.push(online))
    await Promise.resolve()
    const listener = notify as ((status: { connected: boolean }) => void) | null
    listener?.({ connected: false })
    listener?.({ connected: true })
    unsubscribe()

    expect(states).toEqual([false, true])
    expect(remove).toHaveBeenCalledOnce()
  })

  it('removes a listener that completes registration after cleanup', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    let finish: ((handle: { remove(): Promise<void> }) => void) | null = null
    addListener.mockReturnValue(new Promise((resolve) => { finish = resolve }))

    const unsubscribe = new CapacitorConnectivity().subscribe(() => undefined)
    unsubscribe()
    const resolve = finish as ((handle: { remove(): Promise<void> }) => void) | null
    resolve?.({ remove })
    await Promise.resolve()

    expect(remove).toHaveBeenCalledOnce()
  })
})
