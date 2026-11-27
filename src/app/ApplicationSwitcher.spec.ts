import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '@/api/account'
import { ApiError } from '@/api/http'
import { messages, setLocale } from '@/locales'
import ApplicationSwitcher from './ApplicationSwitcher.vue'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.restoreAllMocks()
  setLocale('zh-CN')
})

function render() {
  return shallowMount(ApplicationSwitcher, {
    slots: { default: '<button type="button">Applications</button>' },
    global: {
      stubs: {
        ElDropdown: {
          name: 'ElDropdown',
          template: '<div><slot></slot><slot name="dropdown"></slot></div>',
        },
        ElDropdownMenu: { template: '<div><slot></slot></div>' },
        ElDropdownItem: {
          props: ['command', 'disabled'],
          emits: ['click'],
          template:
            '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot></slot></button>',
        },
      },
    },
  })
}

const entry: api.UserApplicationEntry = {
  appCode: 'cms-ai',
  name: 'CMS',
  entryUrl: 'http://localhost:8850/api-test/main/login/account',
}

describe('application switcher', () => {
  it('loads the current account entries and selects the registered application start URL', async () => {
    const request = vi.spyOn(api, 'getMyApplications').mockResolvedValue([entry])
    const wrapper = render()
    expect(request).not.toHaveBeenCalled()
    const dropdown = wrapper.getComponent({ name: 'ElDropdown' })
    dropdown.vm.$emit('visible-change', true)
    await flushPromises()
    expect(wrapper.text()).toContain('CMS')
    dropdown.vm.$emit('command', 'cms-ai')
    dropdown.vm.$emit('command', 'unknown-application')
    expect(wrapper.emitted('select')).toEqual([[entry.entryUrl]])
    expect(request).toHaveBeenCalledWith()
  })

  it('refreshes on the next opening so withdrawn applications disappear', async () => {
    const request = vi
      .spyOn(api, 'getMyApplications')
      .mockResolvedValueOnce([entry])
      .mockResolvedValue([])
    const wrapper = render()
    const dropdown = wrapper.getComponent({ name: 'ElDropdown' })
    dropdown.vm.$emit('visible-change', true)
    await flushPromises()
    dropdown.vm.$emit('visible-change', false)
    dropdown.vm.$emit('visible-change', true)
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('CMS')
    expect(wrapper.text()).toContain(messages.applicationSwitcher.empty)
  })

  it('offers a localized retry after loading fails', async () => {
    vi.spyOn(api, 'getMyApplications')
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue([])
    setLocale('en-US')
    const wrapper = render()
    wrapper.getComponent({ name: 'ElDropdown' }).vm.$emit('visible-change', true)
    await flushPromises()
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === messages.applicationSwitcher.retry)
    expect(retry).toBeDefined()
    await retry?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(messages.applicationSwitcher.empty)
  })

  it('reports an expired session to the console without offering stale entries', async () => {
    vi.spyOn(api, 'getMyApplications').mockRejectedValue(
      new ApiError(401, {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Expired',
        traceId: 'synthetic',
      }),
    )
    const wrapper = render()
    wrapper.getComponent({ name: 'ElDropdown' }).vm.$emit('visible-change', true)
    await flushPromises()
    expect(wrapper.emitted('unauthorized')).toHaveLength(1)
    expect(wrapper.emitted('select')).toBeUndefined()
  })
})
