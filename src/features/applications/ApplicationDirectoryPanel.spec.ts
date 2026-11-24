import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessageBox } from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '@/api/account'
import { ApiError } from '@/api/http'
import { useSessionStore } from '@/features/session/session.store'
import { setLocale } from '@/locales'
import { enUS } from '@/locales/en-US'
import { zhCN } from '@/locales/zh-CN'
import ApplicationDirectoryPanel from './ApplicationDirectoryPanel.vue'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.restoreAllMocks()
  setLocale('zh-CN')
})

const application: api.ApplicationResponse = {
  appCode: 'cms-ai',
  name: 'CMS',
  entryUrl: 'http://localhost:8850',
  ssoCallbackUrl: 'http://localhost:8850/callback',
  permissionIframeUrl: '',
  notifyBaseUrl: 'http://localhost:9101',
  defaultTenantCode: 'default',
  protocolCapabilities: ['sso', 'directory', 'user_sync', 'menu_permission_v1'],
  status: 'enabled',
  version: 1,
  secretVersion: 1,
  secretState: 'active',
  createdAt: '2026-11-24T00:00:00Z',
  updatedAt: null,
}

function preview(): api.DirectoryImportPreview {
  return {
    importId: 'preview-1',
    status: 'preview',
    expiresAt: '2026-11-24T00:15:00Z',
    newUsers: 1,
    existingUsers: 0,
    snapshot: {
      appCode: 'cms-ai',
      capturedAt: '2026-11-24T00:00:00Z',
      users: [
        {
          localUserId: '9007199254740993',
          account: 'fixture-user',
          status: 'enabled',
          roleIds: ['10'],
          organizationIds: ['20'],
        },
      ],
      roles: [{ localRoleId: '10', code: 'editor', name: 'Editor', status: 'enabled' }],
      organizations: [
        { localOrganizationId: '20', code: 'department', name: 'Department', status: 'enabled' },
      ],
    },
  }
}

async function render() {
  const pinia = createPinia()
  useSessionStore(pinia).session = {
    authenticated: true,
    user: { id: 'admin', account: 'admin', name: 'Administrator' },
    roles: ['ACCOUNT_ADMIN'],
    capabilities: ['applications:write', 'users:import'],
    csrfToken: 'csrf-directory',
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: ApplicationDirectoryPanel }],
  })
  await router.push('/applications/cms-ai')
  await router.isReady()
  vi.spyOn(api, 'getApplicationDirectory').mockResolvedValue({
    appCode: 'cms-ai',
    users: [],
    roles: [],
    organizations: [],
  })
  const wrapper = shallowMount(ApplicationDirectoryPanel, {
    props: { application },
    global: {
      plugins: [pinia, router],
      stubs: {
        ElButton: { template: '<button type="button" @click="$emit(\'click\')"><slot /></button>' },
        ElTabs: { template: '<div><slot /></div>' },
        ElTabPane: { template: '<div><slot /></div>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('application directory import', () => {
  it('keeps preview read only and confirms the exact import with stable IDs', async () => {
    vi.spyOn(api, 'previewApplicationDirectory').mockResolvedValue(preview())
    const commit = vi.spyOn(api, 'commitApplicationDirectory').mockResolvedValue({
      importId: 'preview-1',
      appCode: 'cms-ai',
      createdUsers: 1,
      reusedUsers: 0,
      linkedUsers: 1,
      roles: 1,
      organizations: 1,
    })
    vi.spyOn(ElMessageBox, 'confirm').mockReturnValue(
      Promise.resolve('confirm') as ReturnType<typeof ElMessageBox.confirm>,
    )
    const wrapper = await render()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === zhCN.directory.pull)
      ?.trigger('click')
    await flushPromises()
    expect(commit).not.toHaveBeenCalled()
    expect(wrapper.getComponent({ name: 'ElTable' }).props('data')).toMatchObject([
      { localUserId: '9007199254740993', roleNames: 'Editor', organizationNames: 'Department' },
    ])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === zhCN.directory.commit)
      ?.trigger('click')
    await flushPromises()
    expect(commit).toHaveBeenCalledWith('cms-ai', 'preview-1', 'csrf-directory', expect.any(String))
    expect(wrapper.text()).toContain(zhCN.directory.success)
  })

  it('discards an old preview response after application configuration changes', async () => {
    let resolve: (value: api.DirectoryImportPreview) => void = () => {}
    vi.spyOn(api, 'previewApplicationDirectory').mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = await render()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === zhCN.directory.pull)
      ?.trigger('click')
    await wrapper.setProps({ application: { ...application, version: 2 } })
    resolve(preview())
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'ElTable' })).toHaveLength(0)
    expect(
      wrapper.findAll('button').some((button) => button.text() === zhCN.directory.commit),
    ).toBe(false)
  })

  it('shows safe localized authentication feedback and permits retry', async () => {
    vi.spyOn(api, 'checkApplicationConnection').mockRejectedValue(
      new ApiError(503, {
        code: 'DIRECTORY_AUTH_FAILED',
        message: 'unsafe remote detail',
        traceId: 'fixture',
      }),
    )
    const wrapper = await render()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === zhCN.directory.check)
      ?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(zhCN.directory.authFailed)
    expect(wrapper.text()).not.toContain('unsafe remote detail')
    setLocale('en-US')
    await flushPromises()
    expect(wrapper.text()).toContain(enUS.directory.authFailed)
    expect(wrapper.findAll('button')[0]?.attributes('disabled')).toBeUndefined()
  })
})
