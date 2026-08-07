import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { AiGeneration } from '@/application/ports/AiGenerationGateway'
import GenerationProgress from '@/features/ai-cues/components/GenerationProgress.vue'

const running: AiGeneration = {
  id: '019b9ccb-3f71-7000-8000-000000000520',
  scriptId: '019b9ccb-3f71-7000-8000-000000000510',
  cardId: null,
  status: 'running',
  completedCards: 2,
  totalCards: 5,
  error: null,
  createdAt: '2026-08-07T12:00:00.000Z',
  updatedAt: '2026-08-07T12:01:00.000Z',
}

describe('GenerationProgress', () => {
  it.each([
    ['pending', null, false, 'Запрос ожидает отправки'],
    ['generating', running, false, 'Готовим тезисы: 2 из 5'],
    ['ready', null, false, 'Тезисы готовы'],
    ['stale', null, false, 'Тезисы устарели'],
    ['failed', null, false, 'Не удалось создать тезисы'],
    ['pending', { ...running, status: 'failed' }, false, 'Не удалось создать тезисы'],
    ['pending', null, true, 'Ожидает подключения'],
  ] as const)('renders %s state without replacing it with transport state', (status, generation, offline, label) => {
    const wrapper = mount(GenerationProgress, {
      props: { status, generation, offline, unrestricted: false },
    })

    expect(wrapper.get('[role="status"]').text()).toContain(label)
  })

  it('offers refresh and retry actions for recoverable generation states', async () => {
    const runningWrapper = mount(GenerationProgress, {
      props: { status: 'generating', generation: running, offline: false, unrestricted: false },
    })
    await runningWrapper.get('button[data-action="refresh-generation"]').trigger('click')

    const failedWrapper = mount(GenerationProgress, {
      props: { status: 'failed', generation: null, offline: false, unrestricted: false },
    })
    await failedWrapper.get('button[data-action="retry-generation"]').trigger('click')

    expect(runningWrapper.emitted('refresh')).toHaveLength(1)
    expect(failedWrapper.emitted('retry')).toHaveLength(1)
  })

  it('offers retry when the server generation fails before local sync changes status', () => {
    const wrapper = mount(GenerationProgress, {
      props: {
        status: 'pending',
        generation: { ...running, status: 'failed' },
        offline: false,
        unrestricted: false,
      },
    })

    expect(wrapper.find('[data-action="retry-generation"]').exists()).toBe(true)
  })

  it('does not offer an unconfirmed retry for manual cues', () => {
    const wrapper = mount(GenerationProgress, {
      props: {
        status: 'failed',
        generation: null,
        offline: false,
        unrestricted: false,
        retryable: false,
      },
    })

    expect(wrapper.find('[data-action="retry-generation"]').exists()).toBe(false)
  })

  it('explains superadmin access without rendering a commercial quota counter', () => {
    const wrapper = mount(GenerationProgress, {
      props: { status: 'ready', generation: null, offline: false, unrestricted: true },
    })

    expect(wrapper.text()).toContain('AI доступен без коммерческих ограничений')
    expect(wrapper.text()).not.toContain('Осталось генераций')
    expect(wrapper.text()).not.toMatch(/квот/i)
  })
})
