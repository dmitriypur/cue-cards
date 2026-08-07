<script setup lang="ts">
import { RouterView } from 'vue-router'

import AppShell from '@/shared/ui/AppShell.vue'
import SyncStatusBanner from '@/features/sync/components/SyncStatusBanner.vue'
</script>

<template>
  <SyncStatusBanner />
  <AppShell>
    <RouterView />
  </AppShell>
</template>
