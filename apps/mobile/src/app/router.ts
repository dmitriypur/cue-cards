import {
  createRouter,
  createWebHistory,
  type NavigationGuard,
  type Router,
} from 'vue-router'

import LoginView from '@/features/auth/LoginView.vue'
import ImportPreviewView from '@/features/import/ImportPreviewView.vue'
import ImportSourceView from '@/features/import/ImportSourceView.vue'
import ScriptEditorView from '@/features/editor/ScriptEditorView.vue'
import LibraryView from '@/features/library/LibraryView.vue'
import RecordingView from '@/features/recording/RecordingView.vue'

export function createAppRouter(authGuard?: NavigationGuard): Router {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', redirect: '/login' },
      { path: '/login', name: 'login', component: LoginView },
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

  if (authGuard !== undefined) router.beforeEach(authGuard)

  return router
}
