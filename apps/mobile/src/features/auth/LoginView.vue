<script setup lang="ts">
import { computed, inject, ref } from 'vue'

import {
  authDependenciesKey,
  authNavigationKey,
} from '@/features/auth/auth.dependencies'
import { useAuthStore } from '@/features/auth/auth.store'

const injectedDependencies = inject(authDependenciesKey)
const injectedNavigation = inject(authNavigationKey)
if (injectedDependencies === undefined || injectedNavigation === undefined) {
  throw new Error('Authentication dependencies are unavailable')
}
const dependencies = injectedDependencies
const navigation = injectedNavigation

const store = useAuthStore()
const email = ref('')
const password = ref('')
const deviceName = ref('Android')
const isLoading = computed(() => store.status === 'loading')

async function submit(): Promise<void> {
  const submittedPassword = password.value
  try {
    const authenticated = await store.signIn(dependencies.login, {
      email: email.value.trim(),
      password: submittedPassword,
      device_name: deviceName.value.trim(),
    })
    if (authenticated) await navigation.openLibrary()
  } finally {
    password.value = ''
  }
}
</script>

<template>
  <section class="mx-auto max-w-md rounded-xl border border-border bg-surface p-6 text-surface-foreground shadow-sm">
    <h1 class="text-2xl font-semibold">
      Вход в Cue Cards
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      Войдите один раз, чтобы синхронизировать сценарии и создавать тезисы.
    </p>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label class="block text-sm font-medium">
        Email
        <input
          v-model="email"
          name="email"
          type="email"
          autocomplete="username"
          required
          class="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-foreground"
        >
      </label>

      <label class="block text-sm font-medium">
        Пароль
        <input
          v-model="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          class="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-foreground"
        >
      </label>

      <label class="block text-sm font-medium">
        Имя устройства
        <input
          v-model="deviceName"
          name="device_name"
          type="text"
          autocomplete="off"
          maxlength="255"
          required
          class="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-foreground"
        >
      </label>

      <p v-if="store.failure === 'invalid-credentials'" role="alert" class="text-sm text-destructive">
        Неверный email или пароль.
      </p>
      <p v-else-if="store.failure === 'unknown'" role="alert" class="text-sm text-destructive">
        Не удалось выполнить вход. Попробуйте ещё раз.
      </p>

      <div role="status" class="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        <span v-if="store.failure === 'offline'">
          Сервер сейчас недоступен, но ранее сохранённые сценарии доступны офлайн.
        </span>
        <span v-else>
          Без входа можно открыть сценарии, уже сохранённые на этом устройстве.
        </span>
        <button
          type="button"
          data-action="open-local-library"
          class="mt-3 min-h-12 w-full rounded-md border border-border bg-secondary px-4 font-medium text-secondary-foreground"
          @click="navigation.openLibrary"
        >
          Открыть локальную библиотеку
        </button>
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="min-h-12 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {{ isLoading ? 'Входим…' : 'Войти' }}
      </button>
    </form>
  </section>
</template>
