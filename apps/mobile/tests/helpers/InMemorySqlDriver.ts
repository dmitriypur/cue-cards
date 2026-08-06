import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import type {
  SqlDriver,
  SqlRow,
  SqlRunResult,
  SqlTransaction,
  SqlValue,
} from '@/infrastructure/sqlite/SqlDriver'

class NodeSqlExecutor implements SqlTransaction {
  public constructor(
    protected readonly database: DatabaseSync,
    protected readonly failure: { fragment: string | null },
  ) {}

  public async execute(statements: string): Promise<void> {
    this.throwIfRequested(statements)
    this.database.exec(statements)
  }

  public async run(statement: string, values: readonly SqlValue[] = []): Promise<SqlRunResult> {
    this.throwIfRequested(statement)
    const result = this.database.prepare(statement).run(...(values as readonly SQLInputValue[]))

    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    }
  }

  public async query<T extends SqlRow>(
    statement: string,
    values: readonly SqlValue[] = [],
  ): Promise<readonly T[]> {
    this.throwIfRequested(statement)
    return this.database.prepare(statement).all(...(values as readonly SQLInputValue[])) as T[]
  }

  private throwIfRequested(statement: string): void {
    if (this.failure.fragment !== null && statement.includes(this.failure.fragment)) {
      const fragment = this.failure.fragment
      this.failure.fragment = null
      throw new Error(`Injected SQL failure for: ${fragment}`)
    }
  }
}

export class InMemorySqlDriver extends NodeSqlExecutor implements SqlDriver {
  private readonly failureState: { fragment: string | null }

  public constructor() {
    const database = new DatabaseSync(':memory:')
    const failureState = { fragment: null as string | null }
    super(database, failureState)
    this.failureState = failureState
  }

  public failNextStatementContaining(fragment: string): void {
    this.failureState.fragment = fragment
  }

  public async transaction<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T> {
    this.database.exec('BEGIN IMMEDIATE')

    try {
      const result = await work(this)
      this.database.exec('COMMIT')
      return result
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  public close(): void {
    this.database.close()
  }
}
