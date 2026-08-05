import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

const EmptyLibraryView = defineComponent({
  name: 'EmptyLibraryView',
  setup() {
    return () =>
      h('section', { 'aria-labelledby': 'library-heading' }, [
        h('h1', { id: 'library-heading', class: 'text-2xl font-semibold' }, 'Библиотека'),
        h('p', { class: 'mt-2 text-muted-foreground' }, 'Импортируйте сценарий, чтобы создать первую карточку.'),
      ])
  },
})

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/library' },
    { path: '/library', name: 'library', component: EmptyLibraryView },
  ],
})
