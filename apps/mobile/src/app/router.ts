import { createRouter, createWebHistory, type Router } from 'vue-router'

import ImportPreviewView from '@/features/import/ImportPreviewView.vue'
import ImportSourceView from '@/features/import/ImportSourceView.vue'
import ScriptEditorView from '@/features/editor/ScriptEditorView.vue'
import LibraryView from '@/features/library/LibraryView.vue'
import RecordingView from '@/features/recording/RecordingView.vue'

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
      {
        path: '/scripts/:id/record',
        name: 'script-record',
        component: RecordingView,
        props: (route) => ({ scriptId: route.params.id }),
      },
    ],
  })
}
