import { SecureStorage } from '@aparajita/capacitor-secure-storage'

import type { TokenStore } from '@/application/ports/TokenStore'

const SANCTUM_TOKEN_KEY = 'cue_cards.sanctum_token'

interface SecureStorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export class SecureTokenStore implements TokenStore {
  private readonly storage: SecureStorageAdapter

  public constructor(storage: SecureStorageAdapter = SecureStorage) {
    this.storage = storage
  }

  public async get(): Promise<string | null> {
    return this.storage.getItem(SANCTUM_TOKEN_KEY)
  }

  public async set(token: string): Promise<void> {
    await this.storage.setItem(SANCTUM_TOKEN_KEY, token)
  }

  public async clear(): Promise<void> {
    await this.storage.removeItem(SANCTUM_TOKEN_KEY)
  }
}
