<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import type { SyncConflictRecord } from '@/application/ports/ConflictRepository'
import { syncDependenciesKey, syncNavigationKey } from '@/features/sync/sync.dependencies'
import { useSyncStore } from '@/features/sync/sync.store'

const props = defineProps<{ readonly conflictId: string }>()
const dependencies = inject(syncDependenciesKey, null)
const navigation = inject(syncNavigationKey, null)
const syncStore = useSyncStore()
const conflict = ref<SyncConflictRecord | null>(null)
const loading = ref(true)
const resolving = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    conflict.value = await dependencies?.conflicts.get(props.conflictId) ?? null
    if (conflict.value === null) error.value = 'Конфликт не найден.'
  } catch {
    error.value = 'Не удалось загрузить конфликт.'
  } finally {
    loading.value = false
  }
})

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value))
}

async function useServer(): Promise<void> {
  if (dependencies === null || navigation === null || conflict.value === null) return
  resolving.value = true
  error.value = null
  try {
    await dependencies.resolveConflict.useServer(conflict.value.id)
    await syncStore.run(dependencies.runSync, 'manual')
    await navigation.openLibrary([conflict.value.aggregateId])
  } catch {
    error.value = 'Не удалось применить серверную копию.'
  } finally {
    resolving.value = false
  }
}

async function duplicateLocal(): Promise<void> {
  if (dependencies === null || navigation === null || conflict.value === null) return
  resolving.value = true
  error.value = null
  try {
    const duplicateId = await dependencies.resolveConflict.duplicateLocal(conflict.value.id)
    await syncStore.run(dependencies.runSync, 'manual')
    await navigation.openLibrary([conflict.value.aggregateId, duplicateId])
  } catch {
    error.value = 'Не удалось сохранить локальную копию.'
  } finally {
    resolving.value = false
  }
}
</script>

<template>
  <section aria-labelledby="conflict-heading" class="mx-auto max-w-4xl">
    <h1 id="conflict-heading" class="text-2xl font-semibold">Конфликт синхронизации</h1>
    <p class="mt-2 text-muted-foreground">
      Обе версии сохранены. Выберите, какая останется оригиналом.
    </p>
    <p v-if="loading" role="status" class="mt-6">Загружаем версии…</p>
    <p v-else-if="error" role="alert" class="mt-6 text-destructive">{{ error }}</p>
    <div v-if="conflict" class="mt-6 grid gap-4 md:grid-cols-2">
      <article data-copy="local" class="rounded-xl border bg-surface p-5 text-surface-foreground">
        <p class="text-sm font-medium text-muted-foreground">Локальная копия</p>
        <h2 class="mt-2 text-lg font-semibold">{{ conflict.local.title }}</h2>
        <time :datetime="conflict.local.updatedAt" class="mt-2 block text-sm text-muted-foreground">
          {{ formatTimestamp(conflict.local.updatedAt) }}
        </time>
        <p class="mt-2 text-sm text-muted-foreground">
          При сохранении копии будут включены последние локальные правки с устройства.
        </p>
        <button
          type="button"
          data-action="duplicate-local"
          class="mt-5 min-h-12 rounded-md border border-primary px-4 text-primary"
          :disabled="resolving"
          @click="duplicateLocal"
        >
          Сохранить локальную как копию
        </button>
      </article>
      <article data-copy="server" class="rounded-xl border bg-surface p-5 text-surface-foreground">
        <p class="text-sm font-medium text-muted-foreground">Серверная копия</p>
        <h2 class="mt-2 text-lg font-semibold">{{ conflict.server.title }}</h2>
        <time :datetime="conflict.server.updatedAt" class="mt-2 block text-sm text-muted-foreground">
          {{ formatTimestamp(conflict.server.updatedAt) }}
        </time>
        <button
          type="button"
          data-action="use-server"
          class="mt-5 min-h-12 rounded-md bg-primary px-4 text-primary-foreground"
          :disabled="resolving"
          @click="useServer"
        >
          Использовать серверную копию
        </button>
      </article>
    </div>
  </section>
</template>
