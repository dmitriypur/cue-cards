<script setup lang="ts">
defineProps<{
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly confirmLabel?: string
}>()

defineEmits<{
  cancel: []
  confirm: []
}>()
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    @click.self="$emit('cancel')"
    @keydown.esc="$emit('cancel')"
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      class="w-full max-w-md rounded-xl bg-surface p-5 text-surface-foreground shadow-xl"
    >
      <h2 id="confirm-dialog-title" class="text-lg font-semibold">{{ title }}</h2>
      <p id="confirm-dialog-description" class="mt-2 text-muted-foreground">
        {{ description }}
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          data-action="cancel"
          autofocus
          class="min-h-12 rounded-md border px-4 text-surface-foreground"
          @click="$emit('cancel')"
        >
          Отмена
        </button>
        <button
          type="button"
          data-action="confirm"
          class="min-h-12 rounded-md bg-destructive px-4 text-destructive-foreground"
          @click="$emit('confirm')"
        >
          {{ confirmLabel ?? 'Подтвердить' }}
        </button>
      </div>
    </section>
  </div>
</template>
