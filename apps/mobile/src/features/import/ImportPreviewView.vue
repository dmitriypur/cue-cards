<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { inject, ref } from 'vue'

import ImportBlockCard from '@/features/import/components/ImportBlockCard.vue'
import {
  importNavigationKey,
  importWorkflowKey,
} from '@/features/import/import.dependencies'
import { useImportStore } from '@/features/import/import.store'

const emit = defineEmits<{
  save: []
  cancel: []
}>()

const store = useImportStore()
const { draft, hasErrors } = storeToRefs(store)
const workflow = inject(importWorkflowKey, null)
const navigation = inject(importNavigationKey, null)
const saving = ref(false)
const saveError = ref<string | null>(null)

async function save(): Promise<void> {
  if (draft.value === null) return
  if (workflow === null) {
    emit('save')
    return
  }

  saving.value = true
  saveError.value = null
  try {
    const scriptId = await workflow.saveDraft(draft.value)
    store.clearDraft()
    await navigation?.openLibrary(scriptId)
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : 'Не удалось сохранить сценарий.'
  } finally {
    saving.value = false
  }
}

async function cancel(): Promise<void> {
  store.clearDraft()
  emit('cancel')
  await navigation?.openLibrary()
}
</script>

<template>
  <section v-if="draft" aria-labelledby="import-preview-heading" class="mx-auto max-w-3xl space-y-5">
    <header>
      <h1 id="import-preview-heading" class="text-2xl font-semibold">Предпросмотр импорта</h1>
      <p class="mt-1 text-muted-foreground">Проверьте структуру до локального сохранения.</p>
    </header>

    <label class="block text-sm font-medium">
      Название сценария
      <input
        class="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
        :value="draft.title"
        @input="store.rename(($event.target as HTMLInputElement).value)"
      >
    </label>

    <ImportBlockCard
      v-for="(block, index) in draft.blocks"
      :key="block.id"
      :block="block"
      :index="index"
      :total="draft.blocks.length"
      :issues="draft.issues.filter(({ blockId }) => blockId === block.id)"
      @update-title="store.updateBlock(block.id, { title: $event })"
      @update-text="store.updateBlock(block.id, { fullText: $event })"
      @move="store.moveBlock(block.id, $event)"
      @split="store.splitBlock(block.id, $event)"
      @merge="store.mergeWithNext(block.id)"
      @remove="store.removeEmptyBlock(block.id)"
    />

    <p
      v-for="issue in draft.issues.filter(({ blockId }) => blockId === null)"
      :key="`${issue.code}-${issue.message}`"
      class="rounded-md bg-muted px-3 py-2 text-sm text-surface-foreground"
      :data-issue-severity="issue.severity"
    >
      {{ issue.message }}
    </p>

    <footer class="flex flex-wrap justify-end gap-3">
      <p v-if="saveError" role="alert" class="w-full rounded-md bg-muted p-3 text-surface-foreground">
        {{ saveError }}
      </p>
      <button type="button" class="rounded-md border px-4 py-3" @click="cancel">
        Отмена
      </button>
      <button
        type="button"
        class="rounded-md bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50"
        :disabled="hasErrors || saving"
        @click="save"
      >
        {{ saving ? 'Сохраняем…' : 'Сохранить' }}
      </button>
    </footer>
  </section>

  <section v-else class="rounded-xl border bg-surface p-5 text-surface-foreground">
    <h1 class="text-xl font-semibold">Нет черновика импорта</h1>
    <p class="mt-2 text-muted-foreground">Сначала выберите Markdown- или TXT-файл.</p>
  </section>
</template>
