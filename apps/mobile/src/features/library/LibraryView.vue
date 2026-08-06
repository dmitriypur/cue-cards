<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from 'vue'

import {
  libraryDependenciesKey,
  libraryNavigationKey,
} from '@/features/library/library.dependencies'
import { useLibraryStore } from '@/features/library/library.store'
import ScriptListItem from '@/features/library/components/ScriptListItem.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'

const dependencies = inject(libraryDependenciesKey, null)
const navigation = inject(libraryNavigationKey, null)
const store = useLibraryStore()
const actionError = ref<string | null>(null)
const scriptToDelete = ref<string | null>(null)
const online = ref(dependencies?.isOnline() ?? false)
const undoing = ref(false)

function refreshConnectivity(): void {
  online.value = dependencies?.isOnline() ?? false
}

onMounted(async () => {
  window.addEventListener('online', refreshConnectivity)
  window.addEventListener('offline', refreshConnectivity)
  if (dependencies === null) {
    store.status = 'failed'
    store.error = 'Локальная библиотека недоступна в этой сборке.'
    return
  }
  await store.load(dependencies.listScripts)
})

onUnmounted(() => {
  window.removeEventListener('online', refreshConnectivity)
  window.removeEventListener('offline', refreshConnectivity)
})

async function openScript(scriptId: string, destination: 'edit' | 'record'): Promise<void> {
  if (dependencies === null || navigation === null) return

  actionError.value = null
  try {
    await dependencies.getScript.execute(scriptId)
    if (destination === 'edit') await navigation.openEditor(scriptId)
    else await navigation.openRecording(scriptId)
  } catch {
    actionError.value = 'Не удалось открыть сценарий. Попробуйте ещё раз.'
  }
}

async function confirmDeletion(): Promise<void> {
  if (dependencies === null || scriptToDelete.value === null) return

  const scriptId = scriptToDelete.value
  scriptToDelete.value = null
  actionError.value = null
  try {
    await dependencies.deleteScript.execute(scriptId)
    store.removeForUndo(scriptId)
  } catch {
    actionError.value = 'Не удалось удалить сценарий. Попробуйте ещё раз.'
  }
}

async function undoDeletion(): Promise<void> {
  if (dependencies === null || store.pendingUndo === null) return

  actionError.value = null
  undoing.value = true
  try {
    await dependencies.deleteScript.undo(store.pendingUndo.script.id)
    store.pendingUndo = null
    await store.load(dependencies.listScripts)
  } catch {
    actionError.value = 'Не удалось восстановить сценарий. Попробуйте ещё раз.'
  } finally {
    undoing.value = false
  }
}
</script>

<template>
  <section aria-labelledby="library-heading" class="mx-auto max-w-3xl">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 id="library-heading" class="text-2xl font-semibold">Библиотека</h1>
        <p class="mt-1 text-muted-foreground">Сценарии доступны на этом устройстве.</p>
      </div>
      <button
        type="button"
        data-action="import"
        class="min-h-12 rounded-md bg-primary px-4 text-primary-foreground"
        @click="navigation?.openImport()"
      >
        Импортировать сценарий
      </button>
    </header>

    <p
      v-if="!online"
      role="status"
      data-testid="offline-status"
      class="mt-4 rounded-md bg-muted p-3 text-surface-foreground"
    >
      Офлайн: локальные сценарии и запись продолжают работать.
    </p>

    <p v-if="store.status === 'loading'" role="status" class="mt-6 text-muted-foreground">
      Загружаем локальные сценарии…
    </p>
    <p v-else-if="store.status === 'failed'" role="alert" class="mt-6 text-destructive">
      {{ store.error }}
    </p>
    <template v-else>
      <p v-if="actionError" role="alert" class="mt-6 text-destructive">
        {{ actionError }}
      </p>
      <div
        v-if="store.status === 'ready' && store.scripts.length === 0"
        class="mt-6 rounded-xl border bg-surface p-6 text-surface-foreground"
      >
        <h2 class="font-semibold">Сценариев пока нет</h2>
        <p class="mt-2 text-muted-foreground">Импортируйте Markdown или TXT, чтобы начать.</p>
      </div>
      <div v-else class="mt-6 grid gap-4">
        <ScriptListItem
          v-for="script in store.scripts"
          :key="script.id"
          :script="script"
          @delete="scriptToDelete = $event"
          @edit="openScript($event, 'edit')"
          @record="openScript($event, 'record')"
        />
      </div>
    </template>

    <div
      v-if="store.pendingUndo"
      data-testid="undo-snackbar"
      role="status"
      class="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-surface p-4 text-surface-foreground shadow-xl"
    >
      <span>Сценарий удалён</span>
      <button
        type="button"
        data-action="undo-delete"
        class="min-h-12 rounded-md px-3 font-medium text-primary"
        :disabled="undoing"
        @click="undoDeletion"
      >
        Отменить
      </button>
    </div>

    <ConfirmDialog
      :open="scriptToDelete !== null"
      title="Удалить сценарий?"
      description="Сценарий будет удалён локально и синхронизирован при появлении сети."
      confirm-label="Удалить"
      @cancel="scriptToDelete = null"
      @confirm="confirmDeletion"
    />
  </section>
</template>
