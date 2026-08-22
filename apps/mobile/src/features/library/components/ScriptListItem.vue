<script setup lang="ts">
import { computed } from 'vue'

import type { ScriptSummary } from '@/domain/scripts/types'
import SyncBadge from '@/features/library/components/SyncBadge.vue'

const props = withDefaults(defineProps<{
  readonly script: ScriptSummary
  readonly focused?: boolean
}>(), { focused: false })
const emit = defineEmits<{
  delete: [scriptId: string]
  edit: [scriptId: string]
  record: [scriptId: string]
}>()

const cueLabel = computed(() => ({
  missing: 'Тезисов пока нет',
  pending: 'Тезисы ожидают отправки',
  generating: 'Создаём тезисы',
  ready: 'Тезисы готовы',
  stale: 'Тезисы устарели',
  failed: 'Ошибка тезисов',
})[props.script.cueStatus])
</script>

<template>
  <article
    :data-script-id="script.id"
    :data-focused="focused"
    class="rounded-xl border bg-surface p-4 text-surface-foreground shadow-sm"
    :class="focused ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold">{{ script.title }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ script.cardCount }} карточек · {{ cueLabel }}
        </p>
        <p class="mt-1 text-sm text-muted-foreground">
          Тезисы на устройстве: {{ script.offlineReadyCardCount }} из {{ script.cardCount }}
          <span v-if="script.cardCount > 0 && script.offlineReadyCardCount === script.cardCount">
            · Готово офлайн
          </span>
        </p>
      </div>
      <SyncBadge :status="script.syncStatus" />
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        data-action="record"
        class="min-h-12 rounded-md bg-primary px-4 text-primary-foreground"
        @click="emit('record', script.id)"
      >
        Начать запись
      </button>
      <button
        type="button"
        data-action="edit"
        class="min-h-12 rounded-md border px-4 text-surface-foreground"
        @click="emit('edit', script.id)"
      >
        Изменить
      </button>
      <button
        type="button"
        data-action="delete"
        class="min-h-12 rounded-md px-4 text-destructive"
        @click="emit('delete', script.id)"
      >
        Удалить
      </button>
    </div>
  </article>
</template>
