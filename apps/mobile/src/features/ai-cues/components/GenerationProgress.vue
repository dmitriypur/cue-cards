<script setup lang="ts">
import { computed } from 'vue'

import type { AiGeneration } from '@/application/ports/AiGenerationGateway'
import type { CueStatus } from '@/domain/scripts/types'

const props = withDefaults(defineProps<{
  readonly status: CueStatus
  readonly generation: AiGeneration | null
  readonly offline: boolean
  readonly unrestricted: boolean
  readonly retryable?: boolean
}>(), { retryable: true })

defineEmits<{
  refresh: []
  retry: []
}>()

const label = computed(() => {
  if (props.offline && props.status === 'pending') return 'Ожидает подключения'
  if (props.generation?.status === 'failed') return 'Не удалось создать тезисы'
  if (props.generation?.status === 'running') {
    return `Готовим тезисы: ${props.generation.completedCards} из ${props.generation.totalCards}`
  }
  if (props.status === 'generating') return 'Готовим тезисы…'
  if (props.status === 'ready') return 'Тезисы готовы'
  if (props.status === 'stale') return 'Тезисы устарели'
  if (props.status === 'failed') return 'Не удалось создать тезисы'
  if (props.status === 'pending') return 'Запрос ожидает отправки'
  return 'Тезисы ещё не созданы'
})
</script>

<template>
  <section class="rounded-lg bg-muted p-3 text-surface-foreground">
    <p role="status" class="text-sm font-medium">{{ label }}</p>
    <p v-if="unrestricted" class="mt-1 text-sm text-muted-foreground">
      AI доступен без коммерческих ограничений
    </p>
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        v-if="generation?.status === 'queued' || generation?.status === 'running'"
        type="button"
        data-action="refresh-generation"
        class="min-h-12 rounded-md border px-3"
        @click="$emit('refresh')"
      >
        Обновить
      </button>
      <button
        v-if="retryable && (generation?.status === 'failed' || status === 'failed' || (offline && status === 'pending'))"
        type="button"
        data-action="retry-generation"
        class="min-h-12 rounded-md border px-3"
        @click="$emit('retry')"
      >
        Повторить
      </button>
    </div>
  </section>
</template>
