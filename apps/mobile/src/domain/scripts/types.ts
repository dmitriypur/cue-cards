export type UUID = string
export type IsoTimestamp = string

export type CueStatus =
  | 'missing'
  | 'pending'
  | 'generating'
  | 'ready'
  | 'stale'
  | 'failed'

export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflict'
export type SourceFormat = 'markdown' | 'text'

export interface CueSet {
  readonly id: UUID
  readonly cardId: UUID
  readonly cues: readonly string[]
  readonly sourceHash: string | null
  readonly status: CueStatus
  readonly generationId: UUID | null
  readonly manuallyEdited: boolean
  readonly version: number
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
}

export interface ScriptCard {
  readonly id: UUID
  readonly scriptId: UUID
  readonly position: number
  readonly title: string
  readonly fullText: string
  readonly contentHash: string
  readonly version: number
  readonly cueSet: CueSet
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
  readonly deletedAt: IsoTimestamp | null
}

export interface ScriptAggregate {
  readonly id: UUID
  readonly title: string
  readonly sourceFormat: SourceFormat
  readonly sourceText: string
  readonly importHash: string
  readonly serverVersion: number
  readonly syncStatus: SyncStatus
  readonly cards: readonly ScriptCard[]
  readonly lastOpenedAt: IsoTimestamp | null
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
  readonly deletedAt: IsoTimestamp | null
}

export interface ScriptSummary {
  readonly id: UUID
  readonly title: string
  readonly cardCount: number
  readonly cueStatus: CueStatus
  readonly syncStatus: SyncStatus
  readonly lastOpenedAt: IsoTimestamp | null
  readonly updatedAt: IsoTimestamp
}
