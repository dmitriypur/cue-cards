import { App as CapacitorApp } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'

export function registerAppBackgroundListener(
  listener: () => void | Promise<void>,
): () => void {
  let active = true
  let handle: PluginListenerHandle | null = null

  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (active && !isActive) void listener()
  }).then((registeredHandle) => {
    if (!active) {
      void registeredHandle.remove()
      return
    }
    handle = registeredHandle
  })

  return () => {
    active = false
    if (handle !== null) {
      void handle.remove()
      handle = null
    }
  }
}
