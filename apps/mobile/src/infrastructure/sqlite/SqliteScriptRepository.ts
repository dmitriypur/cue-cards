import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type {
  CueSet,
  CueStatus,
  ScriptAggregate,
  ScriptCard,
  ScriptSummary,
  SourceFormat,
  SyncStatus,
  UUID,
} from '@/domain/scripts/types'
import type {
  SqlDriver,
  SqlExecutor,
  SqlRow,
  SqlTransaction,
} from '@/infrastructure/sqlite/SqlDriver'

type ScriptRow = SqlRow & {
  id: string
  title: string
  source_format: string
  source_text: string
  import_hash: string
  server_version: number
  sync_status: string
  last_opened_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type CardRow = SqlRow & {
  id: string
  script_id: string
  position: number
  title: string
  full_text: string
  content_hash: string
  version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type CueSetRow = SqlRow & {
  id: string
  card_id: string
  cues: string
  source_hash: string | null
  status: string
  generation_id: string | null
  manually_edited: number
  version: number
  created_at: string
  updated_at: string
}

type SummaryRow = SqlRow & {
  id: string
  title: string
  card_count: number
  cue_status: string
  sync_status: string
  last_opened_at: string | null
  updated_at: string
}

export class SqliteScriptRepository implements ScriptRepository {
  private readonly driver: SqlDriver

  public constructor(driver: SqlDriver) {
    this.driver = driver
  }

  public async list(): Promise<readonly ScriptSummary[]> {
    const rows = await this.driver.query<SummaryRow>(`
      SELECT
        scripts.id,
        scripts.title,
        COUNT(cards.id) AS card_count,
        CASE
          WHEN SUM(CASE WHEN cue_sets.status = 'failed' THEN 1 ELSE 0 END) > 0 THEN 'failed'
          WHEN SUM(CASE WHEN cue_sets.status = 'stale' THEN 1 ELSE 0 END) > 0 THEN 'stale'
          WHEN SUM(CASE WHEN cue_sets.status = 'generating' THEN 1 ELSE 0 END) > 0 THEN 'generating'
          WHEN SUM(CASE WHEN cue_sets.status = 'pending' THEN 1 ELSE 0 END) > 0 THEN 'pending'
          WHEN COUNT(cards.id) > 0 AND SUM(CASE WHEN cue_sets.status = 'ready' THEN 1 ELSE 0 END) = COUNT(cards.id) THEN 'ready'
          ELSE 'missing'
        END AS cue_status,
        scripts.sync_status,
        scripts.last_opened_at,
        scripts.updated_at
      FROM scripts
      LEFT JOIN cards ON cards.script_id = scripts.id AND cards.deleted_at IS NULL
      LEFT JOIN cue_sets ON cue_sets.card_id = cards.id
      WHERE scripts.deleted_at IS NULL
      GROUP BY scripts.id
      ORDER BY COALESCE(scripts.last_opened_at, scripts.updated_at) DESC, scripts.updated_at DESC
    `)

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      cardCount: row.card_count,
      cueStatus: row.cue_status as CueStatus,
      syncStatus: row.sync_status as SyncStatus,
      lastOpenedAt: row.last_opened_at,
      updatedAt: row.updated_at,
    }))
  }

  public async get(id: UUID, tx?: SqlTransaction): Promise<ScriptAggregate | null> {
    const executor = tx ?? this.driver
    const [script] = await executor.query<ScriptRow>(
      'SELECT * FROM scripts WHERE id = ? LIMIT 1',
      [id],
    )

    if (script === undefined) {
      return null
    }

    const cardRows = await executor.query<CardRow>(
      'SELECT * FROM cards WHERE script_id = ? ORDER BY position',
      [id],
    )
    const cueRows = await executor.query<CueSetRow>(
      `SELECT cue_sets.* FROM cue_sets
       INNER JOIN cards ON cards.id = cue_sets.card_id
       WHERE cards.script_id = ?`,
      [id],
    )
    const cuesByCard = new Map(cueRows.map((row) => [row.card_id, this.mapCueSet(row)]))

    return {
      id: script.id,
      title: script.title,
      sourceFormat: script.source_format as SourceFormat,
      sourceText: script.source_text,
      importHash: script.import_hash,
      serverVersion: script.server_version,
      syncStatus: script.sync_status as SyncStatus,
      cards: cardRows.map((row) => this.mapCard(row, cuesByCard.get(row.id))),
      lastOpenedAt: script.last_opened_at,
      createdAt: script.created_at,
      updatedAt: script.updated_at,
      deletedAt: script.deleted_at,
    }
  }

  public async save(aggregate: ScriptAggregate, tx?: SqlTransaction): Promise<void> {
    const executor = tx ?? this.driver

    await executor.run(
      `INSERT INTO scripts (
        id, title, source_format, source_text, import_hash, server_version, sync_status,
        last_opened_at, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        source_format = excluded.source_format,
        source_text = excluded.source_text,
        import_hash = excluded.import_hash,
        server_version = excluded.server_version,
        sync_status = excluded.sync_status,
        last_opened_at = excluded.last_opened_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at`,
      [
        aggregate.id,
        aggregate.title,
        aggregate.sourceFormat,
        aggregate.sourceText,
        aggregate.importHash,
        aggregate.serverVersion,
        aggregate.syncStatus,
        aggregate.lastOpenedAt,
        aggregate.createdAt,
        aggregate.updatedAt,
        aggregate.deletedAt,
      ],
    )

    await executor.run(
      'UPDATE cards SET position = position + 1000000 WHERE script_id = ?',
      [aggregate.id],
    )

    for (const card of aggregate.cards) {
      await this.insertCard(executor, card)
      await this.insertCueSet(executor, card.cueSet)
    }

    if (aggregate.cards.length === 0) {
      await executor.run('DELETE FROM cards WHERE script_id = ?', [aggregate.id])
      return
    }

    const placeholders = aggregate.cards.map(() => '?').join(', ')
    await executor.run(
      `DELETE FROM cards WHERE script_id = ? AND id NOT IN (${placeholders})`,
      [aggregate.id, ...aggregate.cards.map((card) => card.id)],
    )
  }

  public async softDelete(id: UUID, deletedAt: string, tx?: SqlTransaction): Promise<void> {
    const executor = tx ?? this.driver
    await executor.run(
      `UPDATE scripts
       SET deleted_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [deletedAt, deletedAt, id],
    )
    await executor.run(
      'UPDATE cards SET deleted_at = ?, updated_at = ? WHERE script_id = ?',
      [deletedAt, deletedAt, id],
    )
  }

  private async insertCard(executor: SqlExecutor, card: ScriptCard): Promise<void> {
    await executor.run(
      `INSERT INTO cards (
        id, script_id, position, title, full_text, content_hash, version,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        script_id = excluded.script_id,
        position = excluded.position,
        title = excluded.title,
        full_text = excluded.full_text,
        content_hash = excluded.content_hash,
        version = excluded.version,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at`,
      [
        card.id,
        card.scriptId,
        card.position,
        card.title,
        card.fullText,
        card.contentHash,
        card.version,
        card.createdAt,
        card.updatedAt,
        card.deletedAt,
      ],
    )
  }

  private async insertCueSet(executor: SqlExecutor, cueSet: CueSet): Promise<void> {
    await executor.run(
      'DELETE FROM cue_sets WHERE card_id = ? AND id <> ?',
      [cueSet.cardId, cueSet.id],
    )
    await executor.run(
      `INSERT INTO cue_sets (
        id, card_id, cues, source_hash, status, generation_id, manually_edited,
        version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        card_id = excluded.card_id,
        cues = excluded.cues,
        source_hash = excluded.source_hash,
        status = excluded.status,
        generation_id = excluded.generation_id,
        manually_edited = excluded.manually_edited,
        version = excluded.version,
        updated_at = excluded.updated_at`,
      [
        cueSet.id,
        cueSet.cardId,
        JSON.stringify(cueSet.cues),
        cueSet.sourceHash,
        cueSet.status,
        cueSet.generationId,
        cueSet.manuallyEdited ? 1 : 0,
        cueSet.version,
        cueSet.createdAt,
        cueSet.updatedAt,
      ],
    )
  }

  private mapCueSet(row: CueSetRow): CueSet {
    return {
      id: row.id,
      cardId: row.card_id,
      cues: JSON.parse(row.cues) as string[],
      sourceHash: row.source_hash,
      status: row.status as CueStatus,
      generationId: row.generation_id,
      manuallyEdited: row.manually_edited === 1,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapCard(row: CardRow, cueSet: CueSet | undefined): ScriptCard {
    if (cueSet === undefined) {
      throw new Error(`Card ${row.id} has no cue set`)
    }

    return {
      id: row.id,
      scriptId: row.script_id,
      position: row.position,
      title: row.title,
      fullText: row.full_text,
      contentHash: row.content_hash,
      version: row.version,
      cueSet,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }
  }
}
