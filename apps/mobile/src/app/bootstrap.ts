import { Capacitor } from '@capacitor/core'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from '@/App.vue'
import { router } from '@/app/router'
import { CapacitorSqlDriver } from '@/infrastructure/sqlite/CapacitorSqlDriver'

export async function bootstrapApp(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const database = new CapacitorSqlDriver()
    await database.initialize()
  }

  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  await router.isReady()
  app.mount('#app')
}
