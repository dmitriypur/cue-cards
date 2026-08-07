import type { PluginListenerHandle } from '@capacitor/core'
import { Network } from '@capacitor/network'

import type { Connectivity, Unsubscribe } from '@/application/ports/Connectivity'

export class CapacitorConnectivity implements Connectivity {
  public async current(): Promise<boolean> {
    return (await Network.getStatus()).connected
  }

  public subscribe(listener: (online: boolean) => void): Unsubscribe {
    let active = true
    let handle: PluginListenerHandle | null = null

    void Network.addListener('networkStatusChange', ({ connected }) => {
      if (active) listener(connected)
    }).then((registered) => {
      if (!active) {
        void registered.remove()
        return
      }
      handle = registered
    })

    return () => {
      active = false
      if (handle !== null) {
        void handle.remove()
        handle = null
      }
    }
  }
}
