<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  readonly open: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: [nextTitle: string]
}>()

const nextTitle = ref('')

watch(() => props.open, (open) => {
  if (open) nextTitle.value = ''
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="split-dialog-title"
      class="w-full max-w-md rounded-xl bg-surface p-5 text-surface-foreground shadow-xl"
    >
      <h2 id="split-dialog-title" class="text-lg font-semibold">Разделить карточку</h2>
      <p class="mt-2 text-muted-foreground">Новая карточка начнётся в позиции курсора.</p>
      <label class="mt-4 grid gap-1">
        <span>Заголовок продолжения</span>
        <input
          v-model="nextTitle"
          data-field="next-title"
          class="min-h-12 rounded-md border bg-surface px-3 text-surface-foreground"
        >
      </label>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="min-h-12 rounded-md px-3" @click="emit('cancel')">
          Отмена
        </button>
        <button
          type="button"
          data-action="confirm-split"
          class="min-h-12 rounded-md bg-primary px-3 text-primary-foreground"
          :disabled="nextTitle.trim() === ''"
          @click="emit('confirm', nextTitle)"
        >
          Разделить
        </button>
      </div>
    </section>
  </div>
</template>
