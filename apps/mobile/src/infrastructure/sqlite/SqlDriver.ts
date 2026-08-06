export type SqlValue = string | number | null
export type SqlRow = Record<string, SqlValue>

export interface SqlRunResult {
  readonly changes: number
  readonly lastInsertRowId?: number
}

export interface SqlExecutor {
  execute(statements: string): Promise<void>
  run(statement: string, values?: readonly SqlValue[]): Promise<SqlRunResult>
  query<T extends SqlRow = SqlRow>(
    statement: string,
    values?: readonly SqlValue[],
  ): Promise<readonly T[]>
}

export interface SqlTransaction extends SqlExecutor {}

export interface SqlDriver extends SqlExecutor {
  transaction<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T>
}
