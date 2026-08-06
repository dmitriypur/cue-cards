import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'

import type {
  SqlDriver,
  SqlRow,
  SqlRunResult,
  SqlTransaction,
  SqlValue,
} from '@/infrastructure/sqlite/SqlDriver'
import { migrateInitialSchema } from '@/infrastructure/sqlite/migrations/001_initial'

const databaseName = 'cue_cards'

export class CapacitorSqlDriver implements SqlDriver {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite)
  private database: SQLiteDBConnection | null = null

  public async initialize(): Promise<void> {
    const existing = await this.sqlite.isConnection(databaseName, false)
    this.database = existing.result === true
      ? await this.sqlite.retrieveConnection(databaseName, false)
      : await this.sqlite.createConnection(databaseName, false, 'no-encryption', 1, false)

    await this.database.open()
    await migrateInitialSchema(this)
  }

  public async execute(statements: string): Promise<void> {
    await this.connection().execute(statements, false)
  }

  public async run(
    statement: string,
    values: readonly SqlValue[] = [],
  ): Promise<SqlRunResult> {
    const result = await this.connection().run(statement, [...values], false)

    return {
      changes: result.changes?.changes ?? 0,
      ...(result.changes?.lastId === undefined
        ? {}
        : { lastInsertRowId: result.changes.lastId }),
    }
  }

  public async query<T extends SqlRow>(
    statement: string,
    values: readonly SqlValue[] = [],
  ): Promise<readonly T[]> {
    const result = await this.connection().query(statement, [...values])
    const rows: unknown = result.values ?? []

    if (!Array.isArray(rows)) {
      throw new Error('SQLite returned an invalid row collection')
    }

    return rows.map((row) => this.toSqlRow(row) as T)
  }

  public async transaction<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T> {
    const database = this.connection()
    await database.beginTransaction()

    try {
      const result = await work(this)
      await database.commitTransaction()
      return result
    } catch (error) {
      await database.rollbackTransaction()
      throw error
    }
  }

  private connection(): SQLiteDBConnection {
    if (this.database === null) {
      throw new Error('SQLite driver has not been initialized')
    }

    return this.database
  }

  private toSqlRow(value: unknown): SqlRow {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('SQLite returned an invalid row')
    }

    const row: SqlRow = {}
    for (const [key, item] of Object.entries(value)) {
      if (typeof item !== 'string' && typeof item !== 'number' && item !== null) {
        throw new Error(`SQLite returned an unsupported value for ${key}`)
      }
      row[key] = item
    }

    return row
  }
}
