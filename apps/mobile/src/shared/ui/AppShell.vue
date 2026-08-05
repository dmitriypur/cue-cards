<template>
  <div class="min-h-dvh bg-background text-foreground">
    <header class="border-b border-border bg-surface text-surface-foreground">
      <div class="mx-auto flex min-h-16 max-w-5xl items-center px-4">
        <span class="text-lg font-semibold">Cue Cards</span>
      </div>
    </header>

    <main class="mx-auto w-full max-w-5xl px-4 py-8">
      <slot />
    </main>
  </div>
</template>
