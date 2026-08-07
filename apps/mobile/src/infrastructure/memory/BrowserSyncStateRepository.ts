import type { SyncStateRepository } from '@/application/ports/SyncStateRepository'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

const STORAGE_KEY = 'cue_cards.e2e.sync_cursor'

export class BrowserSyncStateRepository implements SyncStateRepository {
  public async cursor(): Promise<number> {
    const value = Number(localStorage.getItem(STORAGE_KEY) ?? '0')
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  }

  public async setCursor(cursor: number, _tx?: SqlTransaction): Promise<void> {
    localStorage.setItem(STORAGE_KEY, String(cursor))
  }
}
