<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { ScriptCard } from '@/domain/scripts/types'
import EditableCard from '@/features/editor/components/EditableCard.vue'
import SplitCardDialog from '@/features/editor/components/SplitCardDialog.vue'
import { editorDependenciesKey } from '@/features/editor/editor.dependencies'
import { useEditorStore } from '@/features/editor/editor.store'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'

const props = defineProps<{
  readonly scriptId: string
}>()

interface CardDraft {
  readonly cardId: string
  readonly title: string
  readonly fullText: string
}

interface SplitRequest {
  readonly cardId: string
  readonly offset: number
}

const dependencies = inject(editorDependenciesKey, null)
const store = useEditorStore()
const localCards = ref<ScriptCard[]>([])
const drafts = new Map<string, CardDraft>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const splitRequest = ref<SplitRequest | null>(null)
const mergeCardId = ref<string | null>(null)
let removeBackgroundListener: (() => void) | null = null

const saveLabel = computed(() => ({
  saved: 'Сохранено локально',
  pending: 'Ожидает локального сохранения…',
  saving: 'Сохраняем локально…',
  failed: 'Ошибка локального сохранения',
}[store.saveStatus]))

watch(() => store.script?.cards, (cards) => {
  if (cards !== undefined) localCards.value = [...cards]
}, { immediate: true })

onMounted(async () => {
  if (dependencies === null) {
    store.status = 'failed'
    store.error = 'Локальный редактор недоступен в этой сборке.'
    return
  }
  await store.load(props.scriptId, dependencies)
  removeBackgroundListener = dependencies.onAppBackground(flushAll)
  window.addEventListener('beforeunload', flushAll)
})

onUnmounted(() => {
  removeBackgroundListener?.()
  window.removeEventListener('beforeunload', flushAll)
  void flushAll()
})

function scheduleDraft(draft: CardDraft): void {
  drafts.set(draft.cardId, draft)
  store.markPending()
  const currentTimer = timers.get(draft.cardId)
  if (currentTimer !== undefined) clearTimeout(currentTimer)
  timers.set(draft.cardId, setTimeout(() => {
    timers.delete(draft.cardId)
    void flushDraft(draft.cardId)
  }, 350))
}

async function flushDraft(cardId: string): Promise<void> {
  if (dependencies === null) return
  const draft = drafts.get(cardId)
  if (draft === undefined) return
  drafts.delete(cardId)
  const timer = timers.get(cardId)
  if (timer !== undefined) clearTimeout(timer)
  timers.delete(cardId)
  await store.persist(() => dependencies.updateCard.execute({
    scriptId: props.scriptId,
    ...draft,
  }))
}

async function flushAll(): Promise<void> {
  for (const cardId of [...drafts.keys()]) {
    await flushDraft(cardId)
  }
}

async function reorder(orderedCards: readonly ScriptCard[]): Promise<void> {
  if (dependencies === null) return
  localCards.value = [...orderedCards]
  await store.persist(() => dependencies.reorderCards.execute({
    scriptId: props.scriptId,
    orderedCardIds: orderedCards.map(({ id }) => id),
  }))
}

function moveCard(payload: { readonly cardId: string; readonly direction: -1 | 1 }): void {
  const index = localCards.value.findIndex(({ id }) => id === payload.cardId)
  const nextIndex = index + payload.direction
  if (index < 0 || nextIndex < 0 || nextIndex >= localCards.value.length) return
  const next = [...localCards.value]
  const current = next[index]!
  next[index] = next[nextIndex]!
  next[nextIndex] = current
  void reorder(next)
}

function reorderFromDrag(cards: ScriptCard[]): void {
  void reorder(cards)
}

async function confirmSplit(nextTitle: string): Promise<void> {
  if (dependencies === null || splitRequest.value === null) return
  const request = splitRequest.value
  splitRequest.value = null
  await flushDraft(request.cardId)
  await store.persist(() => dependencies.splitCard.execute({
    scriptId: props.scriptId,
    cardId: request.cardId,
    offset: request.offset,
    nextTitle,
  }))
}

async function confirmMerge(): Promise<void> {
  if (dependencies === null || mergeCardId.value === null) return
  const cardId = mergeCardId.value
  mergeCardId.value = null
  await flushDraft(cardId)
  await store.persist(() => dependencies.mergeCards.execute({
    scriptId: props.scriptId,
    cardId,
  }))
}

async function saveCues(payload: { readonly cardId: string; readonly cues: readonly string[] }): Promise<void> {
  if (dependencies === null) return
  await flushDraft(payload.cardId)
  await store.persist(() => dependencies.updateCues.execute({
    scriptId: props.scriptId,
    ...payload,
  }))
}
</script>

<template>
  <section aria-labelledby="editor-heading" class="mx-auto max-w-4xl">
    <p v-if="store.status === 'loading'" role="status" class="text-muted-foreground">
      Загружаем локальный сценарий…
    </p>
    <p v-else-if="store.status === 'failed'" role="alert" class="text-destructive">
      {{ store.error }}
    </p>
    <template v-else-if="store.script">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="editor-heading" class="text-2xl font-semibold">{{ store.script.title }}</h1>
          <p class="mt-1 text-muted-foreground">{{ localCards.length }} карточки</p>
        </div>
        <p role="status" class="rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground">
          {{ saveLabel }}
        </p>
      </header>

      <p v-if="store.error" role="alert" class="mt-4 text-destructive">{{ store.error }}</p>

      <VueDraggable
        :model-value="localCards"
        item-key="id"
        handle="[data-drag-handle]"
        class="mt-6 grid gap-4"
        @update:model-value="reorderFromDrag"
      >
        <EditableCard
          v-for="(card, index) in localCards"
          :key="card.id"
          :card="card"
          :index="index"
          :total="localCards.length"
          @draft="scheduleDraft"
          @move="moveCard"
          @split="splitRequest = $event"
          @merge="mergeCardId = $event"
          @save-cues="saveCues"
        />
      </VueDraggable>
    </template>

    <SplitCardDialog
      :open="splitRequest !== null"
      @cancel="splitRequest = null"
      @confirm="confirmSplit"
    />
    <ConfirmDialog
      :open="mergeCardId !== null"
      title="Объединить карточки?"
      description="Полный текст текущей и следующей карточки будет объединён. Предыдущие тезисы останутся видимыми как устаревшие."
      confirm-label="Объединить"
      @cancel="mergeCardId = null"
      @confirm="confirmMerge"
    />
  </section>
</template>
