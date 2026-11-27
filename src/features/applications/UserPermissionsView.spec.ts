import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { ElButton } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/features/session/session.store'
import { messages } from '@/locales'
import UserPermissionEditor from './UserPermissionEditor.vue'
import UserPermissionsView from './UserPermissionsView.vue'

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

function user(id = 'user-1'): api.UserResponse {
  return {
    id,
    account: id === 'user-1' ? 'alice' : id,
    name: id === 'user-1' ? 'Alice' : id,
    email: 'test@example.test',
    phone: '',
    status: 'enabled',
    version: 1,
  }
}

const application: api.ApplicationResponse = {
  appCode: 'cms-ai',
  name: 'CMS',
  entryUrl: 'https://cms.example.test',
  ssoCallbackUrl: '',
  permissionIframeUrl: '',
  notifyBaseUrl: 'https://cms.example.test',
  defaultTenantCode: '',
  protocolCapabilities: ['user_sync', 'menu_permission_v1'],
  status: 'enabled',
  secretState: 'active',
  secretVersion: 1,
  version: 1,
}

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/user-authorization/:userId/applications/:appCode',
        name: 'user-application-permissions',
        component: UserPermissionsView,
      },
      {
        path: '/user-authorization',
        name: 'user-authorization',
        component: { template: '<div />' },
      },
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/forbidden', name: 'forbidden', component: { template: '<div />' } },
    ],
  })
  await router.push('/user-authorization/user-1/applications/cms-ai')
  const pinia = createPinia()
  const session = useSessionStore(pinia)
  const wrapper = shallowMount(UserPermissionsView, {
    props: { userId: 'user-1', appCode: 'cms-ai' },
    global: { plugins: [pinia, router], stubs: { StatePanel: false } },
  })
  return { wrapper, router, session }
}

describe('user permissions page', () => {
  it('loads the direct link context and returns to the same user and application', async () => {
    const getUser = vi.spyOn(api, 'getUser').mockResolvedValue(user())
    const getApplication = vi.spyOn(api, 'getApplication').mockResolvedValue(application)
    const { wrapper, router } = await render()
    await flushPromises()
    expect(getUser).toHaveBeenCalledWith('user-1')
    expect(getApplication).toHaveBeenCalledWith('cms-ai')
    expect(wrapper.get('.permission-context').text()).toContain('Alicealice')
    expect(wrapper.get('.permission-context').text()).toContain('CMScms-ai')
    expect(wrapper.getComponent(UserPermissionEditor).props()).toEqual({
      userId: 'user-1',
      appCode: 'cms-ai',
    })
    expect(wrapper.find('el-dialog-stub').exists()).toBe(false)
    await router.push(wrapper.getComponent(RouterLink).props('to'))
    expect(router.currentRoute.value).toMatchObject({
      name: 'user-authorization',
      query: { userId: 'user-1', appCode: 'cms-ai' },
    })
  })

  it('ignores a stale user context when the page target changes', async () => {
    let resolve: (value: api.UserResponse) => void = () => {}
    vi.spyOn(api, 'getUser')
      .mockReturnValueOnce(new Promise((done) => (resolve = done)))
      .mockResolvedValueOnce(user('user-2'))
    vi.spyOn(api, 'getApplication').mockResolvedValue(application)
    const { wrapper } = await render()
    await wrapper.setProps({ userId: 'user-2' })
    await flushPromises()
    resolve(user())
    await flushPromises()
    expect(wrapper.get('.permission-context').text()).toContain('user-2')
    expect(wrapper.get('.permission-context').text()).not.toContain('Alice')
    expect(wrapper.getComponent(UserPermissionEditor).props('userId')).toBe('user-2')
  })

  it('does not render the editor until context loads and permits a retry', async () => {
    vi.spyOn(api, 'getUser')
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(user())
    vi.spyOn(api, 'getApplication').mockResolvedValue(application)
    const { wrapper } = await render()
    await flushPromises()
    expect(wrapper.findComponent(UserPermissionEditor).exists()).toBe(false)
    expect(wrapper.getComponent(StatePanel).props('title')).toBe(
      messages.menuPermissions.loadFailed,
    )
    wrapper.getComponent(ElButton).vm.$emit('click')
    await flushPromises()
    expect(wrapper.findComponent(UserPermissionEditor).exists()).toBe(true)
  })

  it.each([401, 403])('handles permission service rejection %i', async (status) => {
    vi.spyOn(api, 'getUser').mockResolvedValue(user())
    vi.spyOn(api, 'getApplication').mockResolvedValue(application)
    const { wrapper, router, session } = await render()
    const expire = vi.spyOn(session, 'expire')
    await flushPromises()
    wrapper
      .getComponent(UserPermissionEditor)
      .vm.$emit(
        'authError',
        new ApiError(status, { code: 'ACCESS_DENIED', message: 'denied', traceId: 'trace' }),
      )
    await flushPromises()
    expect(router.currentRoute.value.name).toBe(status === 401 ? 'login' : 'forbidden')
    expect(expire).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
    expect(router.currentRoute.value.query.redirect).toBe(
      status === 401 ? '/user-authorization/user-1/applications/cms-ai' : undefined,
    )
  })
})
