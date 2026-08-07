import type {
  SqlDriver,
  SqlRow,
  SqlRunResult,
  SqlTransaction,
  SqlValue,
} from '@/infrastructure/sqlite/SqlDriver'

export class MemorySqlDriver implements SqlDriver, SqlTransaction {
  public async execute(_statements: string): Promise<void> {}

  public async run(_statement: string, _values?: readonly SqlValue[]): Promise<SqlRunResult> {
    return { changes: 0 }
  }

  public async query<T extends SqlRow = SqlRow>(
    _statement: string,
    _values?: readonly SqlValue[],
  ): Promise<readonly T[]> {
    return []
  }

  public async transaction<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T> {
    return work(this)
  }
}
