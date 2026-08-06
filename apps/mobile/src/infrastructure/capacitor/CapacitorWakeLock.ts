import { KeepAwake } from '@capacitor-community/keep-awake'

import type { WakeLock } from '@/application/ports/WakeLock'

type WarningListener = (message: string) => void

export class CapacitorWakeLock implements WakeLock {
  private readonly onWarning: WarningListener
  private warning: string | null = null

  public constructor(onWarning: WarningListener = () => undefined) {
    this.onWarning = onWarning
  }

  public async acquire(): Promise<void> {
    try {
      const { isSupported } = await KeepAwake.isSupported()
      if (!isSupported) throw new Error('Keep awake is unsupported')
      await KeepAwake.keepAwake()
    } catch {
      this.report('Не удалось запретить выключение экрана.')
    }
  }

  public async release(): Promise<void> {
    try {
      await KeepAwake.allowSleep()
    } catch {
      this.report('Не удалось разрешить выключение экрана.')
    }
  }

  public takeWarning(): string | null {
    const warning = this.warning
    this.warning = null
    return warning
  }

  private report(message: string): void {
    this.warning = message
    this.onWarning(message)
  }
}
