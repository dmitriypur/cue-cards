<script setup lang="ts">
import { ref } from 'vue'

import type { ImportBlock, ImportIssue } from '@/domain/import/types'

const props = defineProps<{
  block: ImportBlock
  index: number
  total: number
  issues: readonly ImportIssue[]
}>()

const emit = defineEmits<{
  updateTitle: [value: string]
  updateText: [value: string]
  move: [position: number]
  split: [offset: number]
  merge: []
  remove: []
}>()

const textarea = ref<HTMLTextAreaElement | null>(null)

function splitAtCursor(): void {
  const offset = textarea.value?.selectionStart ?? Math.floor(props.block.fullText.length / 2)
  emit('split', offset)
}
</script>

<template>
  <article class="rounded-xl border bg-surface p-4 text-surface-foreground shadow-sm">
    <label class="block text-sm font-medium">
      Заголовок карточки
      <input
        class="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
        :value="block.title"
        @input="emit('updateTitle', ($event.target as HTMLInputElement).value)"
      >
    </label>

    <label class="mt-3 block text-sm font-medium">
      Полный текст
      <textarea
        ref="textarea"
        class="mt-1 min-h-32 w-full rounded-md border bg-background px-3 py-2 text-foreground"
        :value="block.fullText"
        @input="emit('updateText', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <p
      v-for="issue in issues"
      :key="`${issue.code}-${issue.message}`"
      class="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-surface-foreground"
      :data-issue-severity="issue.severity"
    >
      {{ issue.message }}
    </p>

    <div class="mt-3 flex flex-wrap gap-2">
      <button
        v-if="index > 0"
        type="button"
        class="rounded-md border px-3 py-2"
        @click="emit('move', index - 1)"
      >
        Вверх
      </button>
      <button
        v-if="index < total - 1"
        type="button"
        class="rounded-md border px-3 py-2"
        @click="emit('move', index + 1)"
      >
        Вниз
      </button>
      <button type="button" class="rounded-md border px-3 py-2" @click="splitAtCursor">
        Разделить
      </button>
      <button
        v-if="index < total - 1"
        type="button"
        class="rounded-md border px-3 py-2"
        @click="emit('merge')"
      >
        Объединить со следующим
      </button>
      <button
        v-if="block.fullText.trim() === ''"
        type="button"
        class="rounded-md border border-destructive px-3 py-2 text-destructive"
        @click="emit('remove')"
      >
        Удалить пустой блок
      </button>
    </div>
  </article>
</template>
