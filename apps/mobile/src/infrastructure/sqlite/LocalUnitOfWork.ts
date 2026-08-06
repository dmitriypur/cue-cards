import type { SqlDriver, SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

export class LocalUnitOfWork {
  private readonly driver: SqlDriver

  public constructor(driver: SqlDriver) {
    this.driver = driver
  }

  public run<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T> {
    return this.driver.transaction(work)
  }
}
