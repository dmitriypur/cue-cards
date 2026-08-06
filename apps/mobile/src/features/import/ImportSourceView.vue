<script setup lang="ts">
import { inject, ref } from 'vue'

import {
  importNavigationKey,
  importWorkflowKey,
} from '@/features/import/import.dependencies'
import { useImportStore } from '@/features/import/import.store'

const workflow = inject(importWorkflowKey, null)
const navigation = inject(importNavigationKey, null)
const store = useImportStore()
const busy = ref(false)
const error = ref<string | null>(null)

async function chooseFile(): Promise<void> {
  if (workflow === null) {
    error.value = 'Импорт файлов недоступен в этой сборке.'
    return
  }

  busy.value = true
  error.value = null
  try {
    const draft = await workflow.pickDraft()
    if (draft === null) return
    store.setDraft(draft)
    await navigation?.openPreview()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Не удалось прочитать файл.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section aria-labelledby="import-heading" class="mx-auto max-w-xl rounded-xl border bg-surface p-6 text-surface-foreground">
    <h1 id="import-heading" class="text-2xl font-semibold">Импортировать сценарий</h1>
    <p class="mt-2 text-muted-foreground">
      Выберите UTF-8 файл Markdown или TXT размером до 1 МиБ. Разбор выполняется на устройстве.
    </p>
    <p v-if="error" role="alert" class="mt-4 rounded-md bg-muted p-3 text-surface-foreground">
      {{ error }}
    </p>
    <button
      type="button"
      class="mt-5 rounded-md bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50"
      :disabled="busy"
      @click="chooseFile"
    >
      {{ busy ? 'Читаем файл…' : 'Выбрать файл' }}
    </button>
  </section>
</template>
