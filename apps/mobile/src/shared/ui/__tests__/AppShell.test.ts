import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppShell from '@/shared/ui/AppShell.vue'

describe('AppShell', () => {
  it('renders a compact headerless application landmark', () => {
    const wrapper = mount(AppShell, { slots: { default: 'Библиотека' } })

    expect(wrapper.get('main').text()).toContain('Библиотека')
    expect(wrapper.find('header').exists()).toBe(false)
    expect(wrapper.get('main').classes()).toContain('px-1')
  })
})
