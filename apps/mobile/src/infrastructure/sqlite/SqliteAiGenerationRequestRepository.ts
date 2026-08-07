import type {
  AiGenerationRequest,
  AiGenerationRequestRepository,
} from '@/application/ports/AiGenerationRequestRepository'
import type { SqlDriver, SqlRow } from '@/infrastructure/sqlite/SqlDriver'

interface GenerationRequestRow extends SqlRow {
  scope_key: string
  script_id: string
  card_id: string | null
  operation_id: string
  local_prepared: number
  replace_manual: number
  generation_id: string | null
  created_at: string
}

export class SqliteAiGenerationRequestRepository implements AiGenerationRequestRepository {
  private readonly driver: SqlDriver

  public constructor(driver: SqlDriver) {
    this.driver = driver
  }

  public async upsertPending(request: AiGenerationRequest): Promise<void> {
    await this.driver.run(
      `INSERT INTO ai_generation_requests (
        scope_key, script_id, card_id, operation_id, local_prepared,
        replace_manual, generation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
      ON CONFLICT(scope_key) DO UPDATE SET
        script_id = excluded.script_id,
        card_id = excluded.card_id,
        operation_id = excluded.operation_id,
        local_prepared = excluded.local_prepared,
        replace_manual = excluded.replace_manual,
        generation_id = NULL,
        created_at = excluded.created_at`,
      [
        request.scopeKey,
        request.scriptId,
        request.cardId,
        request.operationId,
        request.localPrepared ? 1 : 0,
        request.replaceManual ? 1 : 0,
        request.createdAt,
      ],
    )
  }

  public async markPrepared(scopeKey: string): Promise<void> {
    await this.driver.run(
      'UPDATE ai_generation_requests SET local_prepared = 1 WHERE scope_key = ?',
      [scopeKey],
    )
  }

  public async markStarted(scopeKey: string, generationId: string): Promise<void> {
    await this.driver.run(
      'UPDATE ai_generation_requests SET generation_id = ? WHERE scope_key = ?',
      [generationId, scopeKey],
    )
  }

  public async removeByGeneration(generationId: string): Promise<void> {
    await this.driver.run(
      'DELETE FROM ai_generation_requests WHERE generation_id = ?',
      [generationId],
    )
  }

  public async list(): Promise<readonly AiGenerationRequest[]> {
    const rows = await this.driver.query<GenerationRequestRow>(
      `SELECT scope_key, script_id, card_id, operation_id, local_prepared,
              replace_manual, generation_id, created_at
       FROM ai_generation_requests
       ORDER BY created_at, scope_key`,
    )
    return rows.map((row) => ({
      scopeKey: row.scope_key,
      scriptId: row.script_id,
      cardId: row.card_id,
      operationId: row.operation_id,
      localPrepared: row.local_prepared === 1,
      replaceManual: row.replace_manual === 1,
      generationId: row.generation_id,
      createdAt: row.created_at,
    }))
  }
}
