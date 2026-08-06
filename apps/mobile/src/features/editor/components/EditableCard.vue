<script setup lang="ts">
import { ref, watch } from 'vue'

import type { ScriptCard } from '@/domain/scripts/types'
import CueListEditor from '@/features/editor/components/CueListEditor.vue'

const props = defineProps<{
  readonly card: ScriptCard
  readonly index: number
  readonly total: number
}>()

const emit = defineEmits<{
  draft: [payload: { readonly cardId: string; readonly title: string; readonly fullText: string }]
  move: [payload: { readonly cardId: string; readonly direction: -1 | 1 }]
  split: [payload: { readonly cardId: string; readonly offset: number }]
  merge: [cardId: string]
  saveCues: [payload: { readonly cardId: string; readonly cues: readonly string[] }]
}>()

const title = ref(props.card.title)
const fullText = ref(props.card.fullText)
const textArea = ref<HTMLTextAreaElement | null>(null)

watch(() => props.card, (card) => {
  title.value = card.title
  fullText.value = card.fullText
})

function emitDraft(): void {
  emit('draft', { cardId: props.card.id, title: title.value, fullText: fullText.value })
}

function requestSplit(): void {
  const codeUnitOffset = textArea.value?.selectionStart ?? fullText.value.length
  const offset = Array.from(fullText.value.slice(0, codeUnitOffset)).length
  emit('split', { cardId: props.card.id, offset })
}

const cueLabels: Record<ScriptCard['cueSet']['status'], string> = {
  missing: 'Тезисов пока нет',
  pending: 'Тезисы ожидают генерации',
  generating: 'Тезисы создаются',
  ready: 'Тезисы готовы',
  stale: 'Тезисы устарели',
  failed: 'Ошибка тезисов',
}
</script>

<template>
  <article
    :data-card-id="card.id"
    class="rounded-xl border bg-surface p-4 text-surface-foreground shadow-sm"
  >
    <header class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <button
          type="button"
          data-drag-handle
          aria-label="Перетащить карточку для изменения порядка"
          class="min-h-12 min-w-12 cursor-grab rounded-md border px-3 active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <p class="font-medium">Карточка {{ index + 1 }} из {{ total }}</p>
      </div>
      <span class="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
        {{ cueLabels[card.cueSet.status] }}
      </span>
    </header>

    <label class="mt-4 grid gap-1">
      <span class="text-sm font-medium">Заголовок</span>
      <input
        v-model="title"
        data-field="title"
        class="min-h-12 rounded-md border bg-surface px-3 text-surface-foreground focus-visible:outline-2 focus-visible:outline-primary"
        @input="emitDraft"
      >
    </label>
    <label class="mt-3 grid gap-1">
      <span class="text-sm font-medium">Полный текст</span>
      <textarea
        ref="textArea"
        v-model="fullText"
        data-field="full-text"
        rows="7"
        class="rounded-md border bg-surface p-3 text-surface-foreground focus-visible:outline-2 focus-visible:outline-primary"
        @input="emitDraft"
      />
    </label>

    <CueListEditor :cues="card.cueSet.cues" @save="emit('saveCues', { cardId: card.id, cues: $event })" />

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        data-action="move-up"
        aria-label="Переместить карточку вверх"
        class="min-h-12 min-w-12 rounded-md border px-3"
        :disabled="index === 0"
        @click="emit('move', { cardId: card.id, direction: -1 })"
      >↑</button>
      <button
        type="button"
        data-action="move-down"
        aria-label="Переместить карточку вниз"
        class="min-h-12 min-w-12 rounded-md border px-3"
        :disabled="index === total - 1"
        @click="emit('move', { cardId: card.id, direction: 1 })"
      >↓</button>
      <button
        type="button"
        data-action="split"
        class="min-h-12 rounded-md border px-3"
        @click="requestSplit"
      >Разделить</button>
      <button
        type="button"
        data-action="merge"
        aria-label="Объединить карточку со следующей"
        class="min-h-12 rounded-md border px-3 text-destructive"
        :disabled="index === total - 1"
        @click="emit('merge', card.id)"
      >Объединить</button>
    </div>
  </article>
</template>
