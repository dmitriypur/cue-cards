<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

import type { RecordingMode } from '@/application/ports/RecordingSessionRepository'
import type { ScriptCard } from '@/domain/scripts/types'
import { useHorizontalSwipe } from '@/features/recording/composables/useHorizontalSwipe'

const props = defineProps<{
  readonly card: ScriptCard
  readonly mode: RecordingMode
  readonly fontScale: number
  readonly index: number
  readonly total: number
  readonly scrollTop: number
}>()
const emit = defineEmits<{
  previous: []
  next: []
  toggleMode: []
  scroll: [scrollTop: number]
}>()

const content = ref<HTMLElement | null>(null)
const { onTouchStart, onTouchEnd } = useHorizontalSwipe(
  () => { if (props.index > 0) emit('previous') },
  () => { if (props.index < props.total - 1) emit('next') },
)

async function restoreScroll(): Promise<void> {
  await nextTick()
  if (content.value !== null) content.value.scrollTop = props.scrollTop
}

onMounted(restoreScroll)
watch(() => [props.card.id, props.mode], restoreScroll)
</script>

<template>
  <section
    data-focus-card
    class="mx-auto flex h-[calc(100dvh-13rem)] max-h-[calc(100dvh-13rem)] min-h-0 max-w-4xl flex-col overflow-hidden rounded-2xl border bg-surface p-4 text-surface-foreground sm:p-6"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <header class="flex items-center justify-between gap-3">
      <p class="rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground">
        {{ index + 1 }} из {{ total }}
      </p>
      <h1 class="text-right text-xl font-semibold sm:text-2xl">{{ card.title }}</h1>
    </header>

    <div role="group" class="mt-5 grid grid-cols-2 rounded-xl bg-muted p-1" aria-label="Режим отображения">
      <button
        type="button"
        :aria-pressed="mode === 'cues'"
        aria-label="Показать тезисы"
        class="min-h-12 rounded-lg px-4 aria-pressed:bg-surface"
        @click="mode !== 'cues' && emit('toggleMode')"
      >
        Тезисы
      </button>
      <button
        type="button"
        :aria-pressed="mode === 'full'"
        aria-label="Показать полный текст"
        class="min-h-12 rounded-lg px-4 aria-pressed:bg-surface"
        @click="mode !== 'full' && emit('toggleMode')"
      >
        Полный текст
      </button>
    </div>

    <div
      ref="content"
      data-recording-content
      class="mt-5 min-h-0 flex-1 overflow-y-auto rounded-xl bg-background p-5 leading-relaxed"
      :style="{ fontSize: `${fontScale}rem` }"
      @scroll="mode === 'full' && emit('scroll', ($event.currentTarget as HTMLElement).scrollTop)"
    >
      <ul v-if="mode === 'cues'" class="grid gap-4">
        <li v-for="(cue, cueIndex) in card.cueSet.cues" :key="`${card.id}-${cueIndex}`" class="rounded-lg bg-muted p-4">
          {{ cue }}
        </li>
      </ul>
      <p v-else class="whitespace-pre-wrap">{{ card.fullText }}</p>
    </div>

    <nav aria-label="Навигация по карточкам" class="mt-5 grid grid-cols-[1fr_auto_1fr] gap-2">
      <button
        type="button"
        aria-label="Предыдущая карточка"
        class="min-h-12 min-w-12 rounded-lg border px-4 disabled:opacity-40"
        :disabled="index === 0"
        @click="emit('previous')"
      >
        Назад
      </button>
      <button
        type="button"
        :aria-label="mode === 'cues' ? 'Показать полный текст' : 'Показать тезисы'"
        class="min-h-12 min-w-12 rounded-lg bg-primary px-4 text-primary-foreground"
        @click="emit('toggleMode')"
      >
        {{ mode === 'cues' ? 'Текст' : 'Тезисы' }}
      </button>
      <button
        type="button"
        aria-label="Следующая карточка"
        class="min-h-12 min-w-12 rounded-lg border px-4 disabled:opacity-40"
        :disabled="index === total - 1"
        @click="emit('next')"
      >
        Далее
      </button>
    </nav>
  </section>
</template>
