import type { Connectivity, Unsubscribe } from '@/application/ports/Connectivity'

export class BrowserConnectivity implements Connectivity {
  public async current(): Promise<boolean> { return navigator.onLine }

  public subscribe(listener: (online: boolean) => void): Unsubscribe {
    const online = (): void => { listener(true) }
    const offline = (): void => { listener(false) }
    globalThis.addEventListener('online', online)
    globalThis.addEventListener('offline', offline)
    return () => {
      globalThis.removeEventListener('online', online)
      globalThis.removeEventListener('offline', offline)
    }
  }
}
