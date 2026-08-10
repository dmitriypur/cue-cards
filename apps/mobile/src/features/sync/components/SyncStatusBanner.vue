<script setup lang="ts">
import { computed, inject } from 'vue'

import { syncDependenciesKey, syncNavigationKey } from '@/features/sync/sync.dependencies'
import { useSyncStore } from '@/features/sync/sync.store'

const store = useSyncStore()
const dependencies = inject(syncDependenciesKey, null)
const navigation = inject(syncNavigationKey, null)
const label = computed(() => ({
  offline: 'Офлайн — изменения сохранены на устройстве',
  syncing: 'Синхронизация…',
  'up-to-date': 'Все изменения синхронизированы',
  retrying: 'Повтор синхронизации запланирован',
  'auth-required': 'Войдите для синхронизации',
  conflict: 'Требуется разрешить конфликт',
}[store.state]))

async function retry(): Promise<void> {
  if (dependencies !== null) await store.run(dependencies.runSync, 'manual')
}

async function openConflict(): Promise<void> {
  if (dependencies === null || navigation === null) return
  const conflict = (await dependencies.conflicts.list())[0]
  if (conflict !== undefined) await navigation.openConflict(conflict.id)
}
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-muted px-3 text-center text-sm text-muted-foreground"
  >
    <span class="min-w-0 leading-4 text-xs">{{ label }}</span>
    <button
      v-if="store.state === 'retrying'"
      type="button"
      data-action="retry-sync"
      class="min-h-8 px-2 font-medium text-primary leading-4 text-xs"
      @click="retry"
    >
      Повторить сейчас
    </button>
    <button
      v-else-if="store.state === 'auth-required'"
      type="button"
      data-action="open-login"
      class="min-h-8 px-2 font-medium text-primary leading-4 text-xs"
      @click="navigation?.openLogin()"
    >
      Войти
    </button>
    <button
      v-else-if="store.state === 'conflict'"
      type="button"
      data-action="open-conflict"
      class="min-h-8 px-2 font-medium text-primary leading-4 text-xs"
      @click="openConflict"
    >
      Сравнить версии
    </button>
    <button
      v-else-if="store.state !== 'syncing'"
      type="button"
      data-action="sync-now"
      class="min-h-8 px-2 font-medium text-primary leading-4 text-xs"
      @click="retry"
    >
      Синхронизировать
    </button>
  </div>
</template>
