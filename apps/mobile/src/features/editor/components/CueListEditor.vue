<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  readonly cues: readonly string[]
}>()

const emit = defineEmits<{
  save: [cues: readonly string[]]
}>()

const values = ref([...props.cues])

watch(() => props.cues, (cues) => {
  values.value = [...cues]
})

function addCue(): void {
  values.value.push('')
}

function removeCue(index: number): void {
  if (values.value.length > 1) values.value.splice(index, 1)
}
</script>

<template>
  <fieldset class="mt-4 rounded-lg bg-muted p-4 text-surface-foreground">
    <legend class="px-1 font-medium">Тезисы</legend>
    <div class="grid gap-3">
      <div v-for="(_cue, index) in values" :key="index" class="flex gap-2">
        <input
          v-model="values[index]"
          data-cue-input
          :aria-label="`Тезис ${index + 1}`"
          class="min-h-12 min-w-0 flex-1 rounded-md border bg-surface px-3 text-surface-foreground"
        >
        <button
          type="button"
          data-action="remove-cue"
          :aria-label="`Удалить тезис ${index + 1}`"
          class="min-h-12 min-w-12 rounded-md border"
          :disabled="values.length <= 1"
          @click="removeCue(index)"
        >
          −
        </button>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        data-action="add-cue"
        class="min-h-12 rounded-md border px-3"
        @click="addCue"
      >
        Добавить тезис
      </button>
      <button
        type="button"
        data-action="save-cues"
        class="min-h-12 rounded-md bg-primary px-3 text-primary-foreground"
        @click="emit('save', [...values])"
      >
        Сохранить тезисы
      </button>
    </div>
  </fieldset>
</template>
