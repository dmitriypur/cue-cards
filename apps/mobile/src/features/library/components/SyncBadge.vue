<script setup lang="ts">
import { computed } from 'vue'

import type { SyncStatus } from '@/domain/scripts/types'

const props = defineProps<{ readonly status: SyncStatus }>()

const label = computed(() => ({
  local: 'Только на устройстве',
  pending: 'Ожидает синхронизации',
  synced: 'Синхронизирован',
  conflict: 'Конфликт версий',
})[props.status])
</script>

<template>
  <span class="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
    {{ label }}
  </span>
</template>
