<script setup lang="ts">
import { ref } from 'vue'

import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'

const props = withDefaults(defineProps<{
  readonly manuallyEdited: boolean
  readonly disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{
  regenerate: [replaceManual: boolean]
}>()

const confirming = ref(false)

function requestRegeneration(): void {
  if (props.manuallyEdited) {
    confirming.value = true
    return
  }
  emit('regenerate', false)
}

function confirm(): void {
  confirming.value = false
  emit('regenerate', true)
}
</script>

<template>
  <button
    type="button"
    data-action="regenerate-card"
    class="min-h-12 rounded-md border px-3"
    :disabled="disabled"
    @click="requestRegeneration"
  >
    Создать тезисы заново
  </button>
  <ConfirmDialog
    :open="confirming"
    title="Заменить ручные тезисы?"
    description="Текущие ручные тезисы останутся видимыми до готовности подтверждённой замены. Полный текст не изменится."
    confirm-label="Заменить тезисы"
    @cancel="confirming = false"
    @confirm="confirm"
  />
</template>
