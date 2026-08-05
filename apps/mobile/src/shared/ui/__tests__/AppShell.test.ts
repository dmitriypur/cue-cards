import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppShell from '@/shared/ui/AppShell.vue'

describe('AppShell', () => {
  it('renders the application landmark', () => {
    const wrapper = mount(AppShell, { slots: { default: 'Библиотека' } })

    expect(wrapper.get('main').text()).toContain('Библиотека')
    expect(wrapper.text()).toContain('Cue Cards')
  })
})
