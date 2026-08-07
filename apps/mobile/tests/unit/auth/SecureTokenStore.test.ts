import { describe, expect, it } from 'vitest'

import { SecureTokenStore } from '@/infrastructure/capacitor/SecureTokenStore'

class MemorySecureStorage {
  public readonly values = new Map<string, string>()

  public async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value)
  }

  public async removeItem(key: string): Promise<void> {
    this.values.delete(key)
  }
}

describe('SecureTokenStore', () => {
  it('stores, retrieves, and clears only the Sanctum token key', async () => {
    const storage = new MemorySecureStorage()
    storage.values.set('unrelated', 'keep-me')
    const tokens = new SecureTokenStore(storage)

    expect(await tokens.get()).toBeNull()

    await tokens.set('sanctum-token')
    expect(await tokens.get()).toBe('sanctum-token')
    expect(storage.values).toEqual(new Map([
      ['unrelated', 'keep-me'],
      ['cue_cards.sanctum_token', 'sanctum-token'],
    ]))

    await tokens.clear()
    expect(await tokens.get()).toBeNull()
    expect(storage.values).toEqual(new Map([['unrelated', 'keep-me']]))
  })
})
