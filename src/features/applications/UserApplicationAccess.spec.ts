import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { ElButton } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/account'
import { useSessionStore } from '@/features/session/session.store'
import { messages, setLocale } from '@/locales'
import UserApplicationAccess from './UserApplicationAccess.vue'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setLocale('zh-CN')
})

function access(): api.ApplicationAccessResponse {
  return {
    userId: 'test-user',
    appCode: 'cms-ai',
    applicationName: 'CMS',
    applicationStatus: 'enabled',
    protocolCapabilities: ['sso', 'directory', 'user_sync', 'menu_permission_v1'],
    desiredStatus: 'disabled',
    version: 0,
    integrationStatus: 'not_authorized',
    retryable: false,
  }
}

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: UserApplicationAccess },
      {
        path: '/user-authorization/:userId/applications/:appCode',
        name: 'user-application-permissions',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/')
  const pinia = createPinia()
  const session = useSessionStore(pinia)
  vi.spyOn(session, 'hasCapability').mockReturnValue(true)
  return shallowMount(UserApplicationAccess, {
    props: { userId: 'test-user' },
    global: { plugins: [pinia, router], stubs: { ElButton: false } },
  })
}

describe('application authorization workflow', () => {
  it('does not synchronize before a grant and opens menus only after current confirmation', async () => {
    vi.useFakeTimers()
    const initial = access()
    const pending: api.ApplicationAccessResponse = {
      ...initial,
      desiredStatus: 'enabled',
      version: 1,
      integrationStatus: 'pending',
    }
    vi.spyOn(api, 'listUserApplicationAccess')
      .mockResolvedValueOnce([initial])
      .mockResolvedValue([
        {
          ...pending,
          integrationStatus: 'succeeded',
          appliedStatus: 'enabled',
          appliedVersion: 1,
        },
      ])
    const grant = vi.spyOn(api, 'changeUserApplicationAccess').mockResolvedValue(pending)
    const wrapper = await render()
    await flushPromises()
    expect(wrapper.text()).toContain(messages.access.notAuthorized)
    expect(grant).not.toHaveBeenCalled()
    expect(
      wrapper
        .findAllComponents(RouterLink)
        .some(
          (link) => (link.props('to') as { name?: string }).name === 'user-application-permissions',
        ),
    ).toBe(false)
    const button = wrapper
      .findAllComponents(ElButton)
      .find((item) => item.text() === messages.access.enable)!
    button.vm.$emit('click')
    await flushPromises()
    expect(grant).toHaveBeenCalledWith(
      'test-user',
      'cms-ai',
      expect.objectContaining({ status: 'enabled', version: 0 }),
      '',
      expect.any(String),
    )
    expect(
      wrapper
        .findAllComponents(RouterLink)
        .some(
          (link) => (link.props('to') as { name?: string }).name === 'user-application-permissions',
        ),
    ).toBe(false)
    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()
    expect(wrapper.vm.$router.currentRoute.value).toMatchObject({
      name: 'user-application-permissions',
      params: { userId: 'test-user', appCode: 'cms-ai' },
    })
  })

  it('does not navigate to an application hidden by the current selection', async () => {
    vi.useFakeTimers()
    const pending: api.ApplicationAccessResponse = {
      ...access(),
      desiredStatus: 'enabled',
      version: 1,
      integrationStatus: 'pending',
    }
    vi.spyOn(api, 'listUserApplicationAccess')
      .mockResolvedValueOnce([access()])
      .mockResolvedValue([
        {
          ...pending,
          integrationStatus: 'succeeded',
          appliedStatus: 'enabled',
          appliedVersion: 1,
        },
      ])
    vi.spyOn(api, 'changeUserApplicationAccess').mockResolvedValue(pending)
    const wrapper = await render()
    await flushPromises()
    wrapper
      .findAllComponents(ElButton)
      .find((item) => item.text() === messages.access.enable)!
      .vm.$emit('click')
    await flushPromises()
    await wrapper.setProps({ appCode: 'another-app' })
    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()
    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/')
  })

  it('keeps menu permissions unavailable for stale confirmations', async () => {
    vi.spyOn(api, 'listUserApplicationAccess').mockResolvedValue([
      {
        ...access(),
        desiredStatus: 'enabled',
        version: 2,
        integrationStatus: 'succeeded',
        appliedStatus: 'enabled',
        appliedVersion: 1,
      },
    ])
    const wrapper = await render()
    await flushPromises()
    expect(
      wrapper
        .findAllComponents(RouterLink)
        .some(
          (link) => (link.props('to') as { name?: string }).name === 'user-application-permissions',
        ),
    ).toBe(false)
  })

  it('revokes access without asking for a reason', async () => {
    const current: api.ApplicationAccessResponse = {
      ...access(),
      desiredStatus: 'enabled',
      version: 1,
      integrationStatus: 'succeeded',
      appliedStatus: 'enabled',
      appliedVersion: 1,
    }
    vi.spyOn(api, 'listUserApplicationAccess').mockResolvedValue([current])
    const change = vi.spyOn(api, 'changeUserApplicationAccess').mockResolvedValue({
      ...current,
      desiredStatus: 'disabled',
      version: 2,
      integrationStatus: 'pending',
    })
    const wrapper = await render()
    await flushPromises()
    expect(wrapper.find('el-input-stub').exists()).toBe(false)
    const button = wrapper
      .findAllComponents(ElButton)
      .find((item) => item.text() === messages.access.disable)!
    button.vm.$emit('click')
    await flushPromises()
    expect(change.mock.calls[0]![2]).toMatchObject({ status: 'disabled', version: 1 })
    expect(change.mock.calls[0]![2]).not.toHaveProperty('reason')
  })

  it('preserves the write content and idempotency key when retrying after a language switch', async () => {
    vi.spyOn(api, 'listUserApplicationAccess').mockResolvedValue([access()])
    const grant = vi
      .spyOn(api, 'changeUserApplicationAccess')
      .mockRejectedValue(new Error('timeout'))
    const wrapper = await render()
    await flushPromises()
    function submit() {
      const button = wrapper
        .findAllComponents(ElButton)
        .find((item) => item.text() === messages.access.enable)!
      button.vm.$emit('click')
    }
    submit()
    await flushPromises()
    const first = grant.mock.calls[0]!
    setLocale('vi-VN')
    await flushPromises()
    submit()
    await flushPromises()
    expect(grant.mock.calls[1]).toEqual(first)
  })
})
