import type {
  ConflictRepository,
  SyncConflictRecord,
} from '@/application/ports/ConflictRepository'
import type { UUID } from '@/domain/scripts/types'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

const STORAGE_KEY = 'cue_cards.e2e.conflicts'

export class BrowserConflictRepository implements ConflictRepository {
  public async get(id: UUID, _tx?: SqlTransaction): Promise<SyncConflictRecord | null> {
    return this.readAll().find((conflict) => conflict.id === id) ?? null
  }

  public async list(): Promise<readonly SyncConflictRecord[]> { return this.readAll() }

  public async save(conflict: SyncConflictRecord, _tx?: SqlTransaction): Promise<void> {
    const conflicts = this.readAll().filter(({ id }) => id !== conflict.id)
    conflicts.push(conflict)
    this.writeAll(conflicts)
  }

  public async remove(id: UUID, _tx?: SqlTransaction): Promise<void> {
    this.writeAll(this.readAll().filter((conflict) => conflict.id !== id))
  }

  private readAll(): SyncConflictRecord[] {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return []
    const value: unknown = JSON.parse(stored)
    return Array.isArray(value) ? value as SyncConflictRecord[] : []
  }

  private writeAll(conflicts: readonly SyncConflictRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conflicts))
  }
}
