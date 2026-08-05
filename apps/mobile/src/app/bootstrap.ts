import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from '@/App.vue'
import { router } from '@/app/router'

export async function bootstrapApp(): Promise<void> {
  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  await router.isReady()
  app.mount('#app')
}
