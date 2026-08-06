import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory, RouterLink, type Router } from 'vue-router'

import ImportPreviewView from '@/features/import/ImportPreviewView.vue'
import ImportSourceView from '@/features/import/ImportSourceView.vue'

const EmptyLibraryView = defineComponent({
  name: 'EmptyLibraryView',
  setup() {
    return () =>
      h('section', { 'aria-labelledby': 'library-heading' }, [
        h('h1', { id: 'library-heading', class: 'text-2xl font-semibold' }, 'Библиотека'),
        h('p', { class: 'mt-2 text-muted-foreground' }, 'Импортируйте сценарий, чтобы создать первую карточку.'),
        h(
          RouterLink,
          {
            to: '/import',
            class: 'mt-5 inline-flex rounded-md bg-primary px-4 py-3 text-primary-foreground',
          },
          { default: () => 'Импортировать сценарий' },
        ),
      ])
  },
})

export function createAppRouter(): Router {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', redirect: '/library' },
      { path: '/library', name: 'library', component: EmptyLibraryView },
      { path: '/import', name: 'import-source', component: ImportSourceView },
      { path: '/import/preview', name: 'import-preview', component: ImportPreviewView },
    ],
  })
}
