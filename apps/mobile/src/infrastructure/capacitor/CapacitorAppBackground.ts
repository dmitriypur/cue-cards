import { App as CapacitorApp } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'

export function registerAppBackgroundListener(
  listener: () => void | Promise<void>,
): () => void {
  return registerAppStateListener((isActive) => {
    if (!isActive) return listener()
  })
}

export function registerAppStateListener(
  listener: (isActive: boolean) => void | Promise<void>,
): () => void {
  let active = true
  let handle: PluginListenerHandle | null = null

  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (active) void listener(isActive)
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
