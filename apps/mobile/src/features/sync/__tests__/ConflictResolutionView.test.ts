import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { SyncConflictRecord } from '@/application/ports/ConflictRepository'
import type { ScriptAggregate } from '@/domain/scripts/types'
import ConflictResolutionView from '@/features/sync/ConflictResolutionView.vue'
import SyncStatusBanner from '@/features/sync/components/SyncStatusBanner.vue'
import {
  syncDependenciesKey,
  syncNavigationKey,
  type SyncDependencies,
  type SyncNavigation,
} from '@/features/sync/sync.dependencies'
import { useSyncStore } from '@/features/sync/sync.store'

const local = {
  id: '019b9ccb-3f71-7000-8000-000000000510',
  title: 'Локальная версия',
  updatedAt: '2026-08-07T07:05:00.000Z',
} as ScriptAggregate
const server = {
  ...local,
  title: 'Серверная версия',
  updatedAt: '2026-08-07T07:06:00.000Z',
  serverVersion: 3,
} as ScriptAggregate
const conflict: SyncConflictRecord = {
  id: '019b9ccb-3f71-7000-8000-000000000511',
  aggregateId: local.id,
  operationId: '019b9ccb-3f71-7000-8000-000000000512',
  local,
  server,
  createdAt: '2026-08-07T07:07:00.000Z',
}

describe('ConflictResolutionView', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function mountView(overrides: Partial<SyncDependencies> = {}) {
    const calls: string[] = []
    const dependencies: SyncDependencies = {
      conflicts: { get: async () => conflict, list: async () => [conflict] },
      resolveConflict: {
        useServer: async () => { calls.push('server') },
        duplicateLocal: async () => {
          calls.push('duplicate')
          return '019b9ccb-3f71-7000-8000-000000000520'
        },
      },
      runSync: { execute: async () => ({ state: 'up-to-date', uploaded: 0, downloaded: 0 }) },
      ...overrides,
    }
    const focused: string[][] = []
    const navigation: SyncNavigation = {
      openLibrary: async (ids) => { focused.push([...ids]) },
      openConflict: async () => undefined,
      openLogin: async () => undefined,
    }
    const wrapper = mount(ConflictResolutionView, {
      props: { conflictId: conflict.id },
      global: { provide: {
        [syncDependenciesKey as symbol]: dependencies,
        [syncNavigationKey as symbol]: navigation,
      } },
    })
    return { wrapper, calls, focused }
  }

  it('shows both titled snapshots and explicit resolution actions', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.get('[data-copy="local"] h2').text()).toBe('Локальная версия')
    expect(wrapper.get('[data-copy="server"] h2').text()).toBe('Серверная версия')
    expect(wrapper.get('[data-copy="local"] time').attributes('datetime')).toBe(local.updatedAt)
    expect(wrapper.get('[data-copy="server"] time').attributes('datetime')).toBe(server.updatedAt)
    expect(wrapper.get('[data-copy="local"]').text()).toContain('последние локальные правки')
    expect(wrapper.get('[data-action="use-server"]').text()).toBe('Использовать серверную копию')
    expect(wrapper.get('[data-action="duplicate-local"]').text()).toBe('Сохранить локальную как копию')
  })

  it('returns to the original after accepting server and to both scripts after duplication', async () => {
    const first = mountView()
    await flushPromises()
    await first.wrapper.get('[data-action="use-server"]').trigger('click')
    await flushPromises()
    expect(first.calls).toEqual(['server'])
    expect(first.focused).toEqual([[local.id]])

    const second = mountView()
    await flushPromises()
    await second.wrapper.get('[data-action="duplicate-local"]').trigger('click')
    await flushPromises()
    expect(second.calls).toEqual(['duplicate'])
    expect(second.focused).toEqual([[
      local.id,
      '019b9ccb-3f71-7000-8000-000000000520',
    ]])
  })
})

describe('SyncStatusBanner', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps one stable banner row while synchronization status changes', async () => {
    const store = useSyncStore()
    const wrapper = mount(SyncStatusBanner)
    const banner = wrapper.get('[role="status"]')

    for (const state of ['syncing', 'up-to-date', 'conflict'] as const) {
      store.state = state
      await wrapper.vm.$nextTick()
      expect(banner.classes()).toEqual(expect.arrayContaining([
        'grid',
        'min-h-16',
        'grid-cols-[minmax(0,1fr)_auto]',
        'items-center',
        'gap-2',
      ]))
    }
  })

  it('renders every explicit synchronization state with a status role', async () => {
    const store = useSyncStore()
    const wrapper = mount(SyncStatusBanner)
    const expected = {
      offline: 'Офлайн',
      syncing: 'Синхронизация…',
      'up-to-date': 'Все изменения синхронизированы',
      retrying: 'Повтор синхронизации запланирован',
      'auth-required': 'Войдите для синхронизации',
      conflict: 'Требуется разрешить конфликт',
    } as const

    for (const [state, label] of Object.entries(expected)) {
      store.state = state as keyof typeof expected
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[role="status"]').text()).toContain(label)
    }
  })

  it('offers manual retry, login, and the persisted conflict as explicit actions', async () => {
    const calls: string[] = []
    const dependencies: SyncDependencies = {
      conflicts: { get: async () => conflict, list: async () => [conflict] },
      resolveConflict: { useServer: async () => undefined, duplicateLocal: async () => local.id },
      runSync: {
        execute: async () => {
          calls.push('retry')
          return { state: 'up-to-date', uploaded: 0, downloaded: 0 }
        },
      },
    }
    const navigation: SyncNavigation = {
      openLibrary: async () => undefined,
      openConflict: async (id) => { calls.push(`conflict:${id}`) },
      openLogin: async () => { calls.push('login') },
    }
    const wrapper = mount(SyncStatusBanner, { global: { provide: {
      [syncDependenciesKey as symbol]: dependencies,
      [syncNavigationKey as symbol]: navigation,
    } } })
    const store = useSyncStore()

    store.state = 'retrying'
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-action="retry-sync"]').trigger('click')
    store.state = 'auth-required'
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-action="open-login"]').trigger('click')
    store.state = 'conflict'
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-action="open-conflict"]').trigger('click')

    expect(calls).toEqual(['retry', 'login', `conflict:${conflict.id}`])
  })

  it('offers synchronization now even when the current status is up to date', async () => {
    const calls: string[] = []
    const dependencies: SyncDependencies = {
      conflicts: { get: async () => null, list: async () => [] },
      resolveConflict: { useServer: async () => undefined, duplicateLocal: async () => local.id },
      runSync: {
        execute: async (reason) => {
          calls.push(reason)
          return { state: 'up-to-date', uploaded: 0, downloaded: 0 }
        },
      },
    }
    const wrapper = mount(SyncStatusBanner, { global: { provide: {
      [syncDependenciesKey as symbol]: dependencies,
    } } })

    await wrapper.get('[data-action="sync-now"]').trigger('click')
    await flushPromises()

    expect(calls).toEqual(['manual'])
  })
})
