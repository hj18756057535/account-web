import { describe, it, expect } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { mount } from '@vue/test-utils'
import App from '../App.vue'
import { zhCN } from '@/locales/zh-CN'

describe('App', () => {
  it('renders the active route instead of an engineering placeholder', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: `<h1>${zhCN.brand.product}</h1>` } }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })
    expect(wrapper.get('h1').text()).toBe(zhCN.brand.product)
  })
})
