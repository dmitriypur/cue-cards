import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScriptSummary } from '@/domain/scripts/types'
import {
  libraryDependenciesKey,
  libraryNavigationKey,
  type LibraryDependencies,
  type LibraryNavigation,
} from '@/features/library/library.dependencies'
import LibraryView from '@/features/library/LibraryView.vue'
import { useSyncStore } from '@/features/sync/sync.store'

const summaries: readonly ScriptSummary[] = [
  {
    id: 'generating',
    title: 'Генерация тезисов',
    cardCount: 5,
    offlineReadyCardCount: 2,
    cueStatus: 'generating',
    syncStatus: 'synced',
    lastOpenedAt: '2026-08-06T08:00:00.000Z',
    updatedAt: '2026-08-06T07:00:00.000Z',
  },
  {
    id: 'stale',
    title: 'Тезисы устарели',
    cardCount: 3,
    offlineReadyCardCount: 1,
    cueStatus: 'stale',
    syncStatus: 'pending',
    lastOpenedAt: null,
    updatedAt: '2026-08-06T06:00:00.000Z',
  },
  {
    id: 'failed',
    title: 'Ошибка тезисов',
    cardCount: 2,
    offlineReadyCardCount: 0,
    cueStatus: 'failed',
    syncStatus: 'local',
    lastOpenedAt: null,
    updatedAt: '2026-08-06T05:00:00.000Z',
  },
]

function mountLibrary(options: {
  readonly scripts?: readonly ScriptSummary[]
  readonly restoredScripts?: readonly ScriptSummary[]
  readonly online?: boolean
  readonly focus?: string
} = {}) {
  let online = options.online ?? true
  const list = vi.fn().mockResolvedValue(options.scripts ?? [])
  if (options.restoredScripts !== undefined) {
    list.mockResolvedValueOnce(options.scripts ?? [])
      .mockResolvedValueOnce(options.restoredScripts)
  }
  const get = vi.fn().mockResolvedValue({ id: 'stale' })
  const executeDelete = vi.fn().mockResolvedValue(undefined)
  const undoDelete = vi.fn().mockResolvedValue(undefined)
  const dependencies: LibraryDependencies = {
    listScripts: { execute: list },
    getScript: { execute: get },
    deleteScript: { execute: executeDelete, undo: undoDelete },
    isOnline: () => online,
  }
  const navigation: LibraryNavigation = {
    openImport: vi.fn().mockResolvedValue(undefined),
    openEditor: vi.fn().mockResolvedValue(undefined),
    openRecording: vi.fn().mockResolvedValue(undefined),
  }

  const pinia = createPinia()
  const wrapper = mount(LibraryView, {
    props: options.focus === undefined ? {} : { focus: options.focus },
    global: {
      plugins: [pinia],
      provide: {
        [libraryDependenciesKey as symbol]: dependencies,
        [libraryNavigationKey as symbol]: navigation,
      },
    },
  })

  return {
    wrapper,
    dependencies,
    navigation,
    list,
    get,
    executeDelete,
    undoDelete,
    sync: useSyncStore(pinia),
    setOnline(value: boolean): void {
      online = value
      window.dispatchEvent(new Event(value ? 'online' : 'offline'))
    },
  }
}

describe('LibraryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders an empty offline library with the primary import action', async () => {
    const { wrapper, navigation } = mountLibrary({ online: false })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Библиотека')
    expect(wrapper.text()).toContain('Сценариев пока нет')
    expect(wrapper.get('[role="status"]').text()).toContain('Офлайн')

    await wrapper.get('[data-action="import"]').trigger('click')
    expect(navigation.openImport).toHaveBeenCalledOnce()
  })

  it('renders local statuses and opens Record/Edit only after touching the script', async () => {
    const { wrapper, navigation, get } = mountLibrary({ scripts: summaries })
    await flushPromises()

    expect(wrapper.findAll('[data-script-id]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Создаём тезисы')
    expect(wrapper.text()).toContain('Тезисы устарели')
    expect(wrapper.text()).toContain('Ошибка тезисов')
    expect(wrapper.text()).toContain('Тезисы на устройстве: 2 из 5')
    expect(wrapper.text()).toContain('Тезисы на устройстве: 1 из 3')
    expect(wrapper.text()).toContain('Ожидает синхронизации')

    const staleTile = wrapper.get('[data-script-id="stale"]')
    expect(staleTile.classes()).toContain('text-surface-foreground')
    expect(staleTile.classes()).not.toContain('text-white')

    await staleTile.get('[data-action="record"]').trigger('click')
    expect(get).toHaveBeenLastCalledWith('stale')
    expect(navigation.openRecording).toHaveBeenLastCalledWith('stale')

    await staleTile.get('[data-action="edit"]').trigger('click')
    expect(get).toHaveBeenLastCalledWith('stale')
    expect(navigation.openEditor).toHaveBeenLastCalledWith('stale')
  })

  it('marks a fully downloaded script as ready offline', async () => {
    const ready = [{
      ...summaries[0]!,
      id: 'ready',
      title: 'Готовый сценарий',
      cardCount: 4,
      offlineReadyCardCount: 4,
      cueStatus: 'ready' as const,
    }]
    const { wrapper } = mountLibrary({ scripts: ready })
    await flushPromises()

    expect(wrapper.text()).toContain('Тезисы на устройстве: 4 из 4')
    expect(wrapper.text()).toContain('Готово офлайн')
  })

  it('reloads local readiness after synchronization completes', async () => {
    const ready = [{
      ...summaries[0]!,
      offlineReadyCardCount: 5,
      cueStatus: 'ready' as const,
    }]
    const { wrapper, list, sync } = mountLibrary({
      scripts: [summaries[0]!],
      restoredScripts: ready,
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Тезисы на устройстве: 2 из 5')

    sync.state = 'syncing'
    await flushPromises()
    sync.state = 'up-to-date'
    await flushPromises()

    expect(list).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Тезисы на устройстве: 5 из 5')
  })

  it('requires confirmation and keeps the deletion notice temporary and dismissible', async () => {
    vi.useFakeTimers()
    const restored = [
      { ...summaries[1]!, updatedAt: '2026-08-06T11:00:00.000Z', syncStatus: 'pending' as const },
      summaries[0]!,
      summaries[2]!,
    ]
    const { wrapper, executeDelete, undoDelete, list } = mountLibrary({
      scripts: summaries,
      restoredScripts: restored,
    })
    await flushPromises()

    await wrapper.get('[data-script-id="stale"] [data-action="delete"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Удалить сценарий')
    await wrapper.get('[role="dialog"] [data-action="cancel"]').trigger('click')
    expect(executeDelete).not.toHaveBeenCalled()

    await wrapper.get('[data-script-id="stale"] [data-action="delete"]').trigger('click')
    await wrapper.get('[role="dialog"] [data-action="confirm"]').trigger('click')
    await flushPromises()

    expect(executeDelete).toHaveBeenCalledWith('stale')
    expect(wrapper.find('[data-script-id="stale"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="undo-snackbar"]').text()).toContain('Сценарий удалён')

    await wrapper.get('[data-action="undo-delete"]').trigger('click')
    await flushPromises()
    expect(undoDelete).toHaveBeenCalledWith('stale')
    expect(list).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-script-id="stale"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-script-id]')[0]?.attributes('data-script-id')).toBe('stale')

    await wrapper.get('[data-script-id="failed"] [data-action="delete"]').trigger('click')
    await wrapper.get('[role="dialog"] [data-action="confirm"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-action="dismiss-delete-notice"]').trigger('click')
    expect(wrapper.find('[data-testid="undo-snackbar"]').exists()).toBe(false)

    await wrapper.get('[data-script-id="generating"] [data-action="delete"]').trigger('click')
    await wrapper.get('[role="dialog"] [data-action="confirm"]').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(5_000)
    await flushPromises()
    expect(wrapper.find('[data-testid="undo-snackbar"]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('keeps scripts visible and localizes an action failure', async () => {
    const { wrapper, get } = mountLibrary({ scripts: summaries })
    get.mockRejectedValueOnce(new Error('sensitive internal detail'))
    await flushPromises()

    await wrapper.get('[data-script-id="stale"] [data-action="edit"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Не удалось открыть сценарий')
    expect(wrapper.text()).not.toContain('sensitive internal detail')
    expect(wrapper.findAll('[data-script-id]')).toHaveLength(3)
  })

  it('updates the offline status when browser connectivity changes', async () => {
    const { wrapper, setOnline } = mountLibrary({ scripts: summaries, online: true })
    await flushPromises()
    expect(wrapper.find('[data-testid="offline-status"]').exists()).toBe(false)

    setOnline(false)
    await flushPromises()
    expect(wrapper.get('[data-testid="offline-status"]').text()).toContain('Офлайн')

    setOnline(true)
    await flushPromises()
    expect(wrapper.find('[data-testid="offline-status"]').exists()).toBe(false)
  })

  it('visibly focuses both scripts returned by local conflict duplication', async () => {
    const { wrapper } = mountLibrary({ scripts: summaries, focus: 'stale,failed' })
    await flushPromises()

    expect(wrapper.get('[data-script-id="stale"]').attributes('data-focused')).toBe('true')
    expect(wrapper.get('[data-script-id="failed"]').attributes('data-focused')).toBe('true')
    expect(wrapper.get('[data-script-id="generating"]').attributes('data-focused')).toBe('false')
  })
})
