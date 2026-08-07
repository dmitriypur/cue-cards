import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

export interface SyncStateRepository {
  cursor(): Promise<number>
  setCursor(cursor: number, tx?: SqlTransaction): Promise<void>
}
