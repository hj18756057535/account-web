import { enableAutoUnmount, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { messages, setLocale } from '@/locales'
import ApplicationEntryLink from './ApplicationEntryLink.vue'

enableAutoUnmount(afterEach)
afterEach(() => setLocale('zh-CN'))

const application = {
  name: 'CMS',
  entryUrl: 'https://cms.example.test/login/account',
  status: 'enabled' as const,
  secretState: 'active' as const,
}

describe('application entry link', () => {
  it('opens the registered entry in a separate window with an accessible label', () => {
    const wrapper = shallowMount(ApplicationEntryLink, { props: { application } })
    const link = wrapper.get('a')
    expect(link.attributes()).toMatchObject({
      href: application.entryUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(link.attributes('aria-label')).toContain(application.name)
    expect(link.attributes('aria-label')).toContain(messages.applications.openInNewTab)
  })

  it.each([
    { entryUrl: '' },
    { entryUrl: 'javascript:alert(1)' },
    { entryUrl: 'https://' },
    { status: 'disabled' as const },
    { secretState: 'revoked' as const },
  ])('disables unavailable or unsafe entries: %j', (change) => {
    const wrapper = shallowMount(ApplicationEntryLink, {
      props: { application: { ...application, ...change } },
    })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').attributes('title')).toBeTruthy()
  })

  it('updates the label when the language changes', async () => {
    const wrapper = shallowMount(ApplicationEntryLink, { props: { application } })
    setLocale('vi-VN')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain(messages.applications.enter)
    expect(wrapper.get('a').attributes('title')).toBe(messages.applications.openInNewTab)
  })
})
