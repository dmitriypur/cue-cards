import type { WakeLock } from '@/application/ports/WakeLock'

export class NoopWakeLock implements WakeLock {
  public async acquire(): Promise<void> {}
  public async release(): Promise<void> {}
  public takeWarning(): string | null { return null }
}
