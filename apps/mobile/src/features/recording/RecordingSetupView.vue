<script setup lang="ts">
import { ref } from 'vue'

import type { RecordingMode } from '@/application/ports/RecordingSessionRepository'
import type { ScriptAggregate } from '@/domain/scripts/types'

const props = defineProps<{ readonly script: ScriptAggregate }>()
const emit = defineEmits<{
  start: [input: { cardId: string; mode: RecordingMode; fontScale: number }]
}>()

const cards = props.script.cards
  .filter(({ deletedAt }) => deletedAt === null)
  .sort((left, right) => left.position - right.position)
const cardId = ref(cards[0]?.id ?? '')
const mode = ref<RecordingMode>('cues')
const fontScale = ref(1)
</script>

<template>
  <section aria-labelledby="recording-setup-heading" class="mx-auto max-w-2xl rounded-2xl border bg-surface p-6 text-surface-foreground">
    <h1 id="recording-setup-heading" class="text-2xl font-semibold">Настройка записи</h1>
    <p class="mt-2 text-muted-foreground">{{ script.title }}</p>

    <label class="mt-6 grid gap-2 font-medium">
      Начальная карточка
      <select v-model="cardId" aria-label="Начальная карточка" class="min-h-12 rounded-lg border bg-background px-3 w-full">
        <option v-for="card in cards" :key="card.id" :value="card.id">
          {{ card.position + 1 }}. {{ card.title }}
        </option>
      </select>
    </label>

    <fieldset class="mt-5">
      <legend class="font-medium">Режим по умолчанию</legend>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-label="Тезисы по умолчанию"
          :aria-pressed="mode === 'cues'"
          class="min-h-12 rounded-lg border px-4 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          @click="mode = 'cues'"
        >
          Тезисы
        </button>
        <button
          type="button"
          aria-label="Полный текст по умолчанию"
          :aria-pressed="mode === 'full'"
          class="min-h-12 rounded-lg border px-4 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          @click="mode = 'full'"
        >
          Полный текст
        </button>
      </div>
    </fieldset>

    <label class="mt-5 grid gap-2 font-medium">
      Размер текста
      <select v-model.number="fontScale" aria-label="Размер текста" class="min-h-12 rounded-lg border bg-background px-3">
        <option :value="1">Обычный</option>
        <option :value="1.25">Крупный</option>
        <option :value="1.4">Очень крупный</option>
      </select>
    </label>

    <button
      type="button"
      data-start-recording
      class="mt-7 min-h-12 w-full rounded-lg bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
      :disabled="cardId === ''"
      @click="emit('start', { cardId, mode, fontScale })"
    >
      Начать запись
    </button>
  </section>
</template>
