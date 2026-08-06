<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted } from 'vue'

import FocusCard from '@/features/recording/components/FocusCard.vue'
import RecordingSetupView from '@/features/recording/RecordingSetupView.vue'
import { recordingDependenciesKey } from '@/features/recording/recording.dependencies'
import { useRecordingStore } from '@/features/recording/recording.store'

const props = defineProps<{ readonly scriptId: string }>()
const dependencies = inject(recordingDependenciesKey, null)
const store = useRecordingStore()
let removeBackgroundListener: (() => void) | null = null

const cards = computed(() => store.activeCards)
const currentIndex = computed(() => cards.value.findIndex(({ id }) => id === store.session?.currentCardId))
const currentCard = computed(() => cards.value[currentIndex.value] ?? null)

onMounted(async () => {
  if (dependencies === null) {
    store.status = 'failed'
    store.error = 'Режим записи недоступен в этой сборке.'
    return
  }
  store.enterRoute()
  removeBackgroundListener = dependencies.onAppStateChange(async (isActive) => {
    await store.setAppActive(isActive, dependencies)
  })
  await store.load(props.scriptId, dependencies)
})

onUnmounted(() => {
  removeBackgroundListener?.()
  if (dependencies !== null) void store.leaveRoute(dependencies)
})

function move(direction: 'previous' | 'next'): void {
  if (dependencies !== null) void store.move(direction, dependencies)
}

function toggleMode(): void {
  if (dependencies === null || store.session === null) return
  void store.toggleMode(dependencies)
}
</script>

<template>
  <p v-if="store.status === 'loading'" role="status" class="text-muted-foreground">
    Восстанавливаем локальную сессию…
  </p>
  <p v-else-if="store.status === 'failed'" role="alert" class="text-destructive">
    {{ store.error }}
  </p>
  <template v-else-if="store.script">
    <p v-if="store.error" role="alert" class="mb-4 text-destructive">{{ store.error }}</p>
    <p
      v-if="store.warning"
      data-wake-lock-warning
      role="status"
      class="mb-4 rounded-lg bg-muted p-3 text-muted-foreground"
    >
      {{ store.warning }} Запись продолжает работать.
    </p>
    <RecordingSetupView
      v-if="store.session === null"
      :script="store.script"
      @start="dependencies !== null && store.start($event, dependencies)"
    />
    <div v-else-if="currentCard !== null">
      <FocusCard
        :card="currentCard"
        :mode="store.session.mode"
        :font-scale="store.session.fontScale"
        :index="currentIndex"
        :total="cards.length"
        :scroll-top="store.scrollPositions[currentCard.id] ?? 0"
        @previous="move('previous')"
        @next="move('next')"
        @toggle-mode="toggleMode"
        @scroll="store.rememberScroll(currentCard.id, $event)"
      />
      <button
        v-if="dependencies !== null"
        type="button"
        class="mx-auto mt-4 block min-h-12 rounded-lg px-5 text-muted-foreground underline"
        @click="store.finish(dependencies)"
      >
        Завершить запись
      </button>
    </div>
  </template>
</template>
