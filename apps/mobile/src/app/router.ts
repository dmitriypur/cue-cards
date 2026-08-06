import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory, type Router } from 'vue-router'

import ImportPreviewView from '@/features/import/ImportPreviewView.vue'
import ImportSourceView from '@/features/import/ImportSourceView.vue'
import ScriptEditorView from '@/features/editor/ScriptEditorView.vue'
import LibraryView from '@/features/library/LibraryView.vue'

const PlannedFeatureView = defineComponent({
  name: 'PlannedFeatureView',
  setup() {
    return () =>
      h('section', { class: 'rounded-xl border bg-surface p-6 text-surface-foreground' }, [
        h('h1', { class: 'text-2xl font-semibold' }, 'Раздел готовится'),
        h('p', { class: 'mt-2 text-muted-foreground' }, 'Данные сценария уже сохранены локально.'),
      ])
  },
})

export function createAppRouter(): Router {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', redirect: '/library' },
      { path: '/library', name: 'library', component: LibraryView },
      { path: '/import', name: 'import-source', component: ImportSourceView },
      { path: '/import/preview', name: 'import-preview', component: ImportPreviewView },
      {
        path: '/scripts/:id/edit',
        name: 'script-edit',
        component: ScriptEditorView,
        props: (route) => ({ scriptId: route.params.id }),
      },
      { path: '/scripts/:id/record', name: 'script-record', component: PlannedFeatureView },
    ],
  })
}
