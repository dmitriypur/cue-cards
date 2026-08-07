import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import RegenerateCardButton from '@/features/ai-cues/components/RegenerateCardButton.vue'

describe('RegenerateCardButton', () => {
  it('regenerates non-manual cues immediately', async () => {
    const wrapper = mount(RegenerateCardButton, { props: { manuallyEdited: false } })

    await wrapper.get('[data-action="regenerate-card"]').trigger('click')

    expect(wrapper.emitted('regenerate')).toEqual([[false]])
  })

  it('preserves manual cues until explicit replacement confirmation', async () => {
    const wrapper = mount(RegenerateCardButton, { props: { manuallyEdited: true } })

    await wrapper.get('[data-action="regenerate-card"]').trigger('click')

    expect(wrapper.emitted('regenerate')).toBeUndefined()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Заменить ручные тезисы')
    expect(wrapper.text()).toContain('останутся видимыми до готовности')

    await wrapper.get('[role="dialog"] [data-action="confirm"]').trigger('click')

    expect(wrapper.emitted('regenerate')).toEqual([[true]])
  })
})
