export interface WakeLock {
  acquire(): Promise<void>
  release(): Promise<void>
  takeWarning(): string | null
}
