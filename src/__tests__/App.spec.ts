import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('renders the localized engineering baseline', () => {
    const wrapper = mount(App)
    expect(wrapper.get('h1').text()).toBe('Account 管理端')
    expect(wrapper.get('[role="status"]').text()).toBe('工程基线已就绪')
  })
})
