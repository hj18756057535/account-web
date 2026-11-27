import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/account'
import UserAuthorizationView from './UserAuthorizationView.vue'
import ApplicationIntegrationView from './ApplicationIntegrationView.vue'
import ApplicationDirectoryPanel from './ApplicationDirectoryPanel.vue'
import UserApplicationAccess from './UserApplicationAccess.vue'

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

function user(id: string): api.UserResponse {
  return {
    id,
    account: id,
    name: id,
    email: 'test@example.com',
    phone: '123',
    status: 'enabled',
    version: 1,
  }
}

async function render(path: string, data = false) {
  const component = data ? ApplicationIntegrationView : UserAuthorizationView
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component }],
  })
  await router.push(path)
  const wrapper = shallowMount(component, { global: { plugins: [createPinia(), router] } })
  return { wrapper, router }
}

describe('application workspaces', () => {
  it('resolves a source account to the Account user ID and preserves application context', async () => {
    vi.spyOn(api, 'listUsers').mockResolvedValue({
      items: [{ ...user('global-alice'), account: 'alice' }],
      page: 1,
      size: 30,
      total: 1,
    })
    const { wrapper, router } = await render('/?account=alice&appCode=cms-ai')
    await flushPromises()
    expect(router.currentRoute.value.query.userId).toBe('global-alice')
    expect(wrapper.getComponent(UserApplicationAccess).props()).toMatchObject({
      userId: 'global-alice',
      appCode: 'cms-ai',
    })
  })

  it('discards an earlier user lookup after the selection changes', async () => {
    vi.spyOn(api, 'listUsers').mockResolvedValue({ items: [], page: 1, size: 30, total: 0 })
    let resolve: (value: api.UserResponse) => void = () => {}
    vi.spyOn(api, 'getUser')
      .mockReturnValueOnce(new Promise((done) => (resolve = done)))
      .mockResolvedValueOnce(user('new-user'))
    const { wrapper, router } = await render('/?userId=old-user')
    await router.replace('/?userId=new-user')
    await flushPromises()
    resolve(user('old-user'))
    await flushPromises()
    expect(wrapper.getComponent(UserApplicationAccess).props('userId')).toBe('new-user')
    expect(
      wrapper.findAll('el-option-stub').map((option) => option.attributes('value')),
    ).not.toContain('old-user')
  })

  it('opens the standard directory for an integrated application by default', async () => {
    const app: api.ApplicationResponse = {
      appCode: 'cms-ai',
      name: 'CMS',
      entryUrl: 'https://cms.example.test',
      ssoCallbackUrl: 'https://cms.example.test/callback',
      permissionIframeUrl: '',
      notifyBaseUrl: 'https://cms.example.test',
      defaultTenantCode: 'default',
      protocolCapabilities: ['sso', 'directory', 'user_sync', 'menu_permission_v1'],
      status: 'enabled',
      secretState: 'active',
      secretVersion: 1,
      version: 1,
    }
    vi.spyOn(api, 'listApplications').mockResolvedValue([
      { ...app, appCode: 'oidc-only', protocolCapabilities: ['sso'] },
      app,
    ])
    const { wrapper, router } = await render('/', true)
    await flushPromises()
    expect(router.currentRoute.value.query.appCode).toBe('cms-ai')
    expect(wrapper.getComponent(ApplicationDirectoryPanel).props('application').appCode).toBe(
      'cms-ai',
    )
  })
})
