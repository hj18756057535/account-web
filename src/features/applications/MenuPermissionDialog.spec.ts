import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElTree } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as accountApi from '@/api/account'
import { ApiError } from '@/api/http'
import { useSessionStore } from '@/features/session/session.store'
import { enUS } from '@/locales/en-US'
import { setLocale } from '@/locales'

import MenuPermissionDialog from './MenuPermissionDialog.vue'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.restoreAllMocks()
  setLocale('zh-CN')
})

const access: accountApi.ApplicationAccessResponse = {
  userId: 'user-1',
  appCode: 'app-1',
  applicationName: 'Application',
  applicationStatus: 'enabled',
  protocolCapabilities: ['user_sync', 'menu_permission_v1'],
  desiredStatus: 'enabled',
  version: 7,
  integrationStatus: 'succeeded',
  appliedStatus: 'enabled',
  appliedVersion: 7,
  retryable: false,
}

function snapshot(): accountApi.MenuPermissionResponse {
  return {
    accessVersion: 7,
    catalogRevision: 'catalog-1',
    permissionRevision: 'permission-1',
    assignmentMode: 'ADDITIVE',
    nodes: [
      {
        code: 'managed',
        parentCode: null,
        nodeType: 'MENU',
        defaultName: 'Managed fallback',
        localizedNames: { 'en-US': 'Managed menu' },
        assignable: true,
        sort: 1,
      },
      {
        code: 'native',
        parentCode: null,
        nodeType: 'MENU',
        defaultName: 'Native menu',
        localizedNames: {},
        assignable: true,
        sort: 2,
      },
      {
        code: 'overlap',
        parentCode: null,
        nodeType: 'ACTION',
        defaultName: 'Overlap',
        localizedNames: {},
        assignable: true,
        sort: 3,
      },
    ],
    selectedCodes: ['managed', 'overlap'],
    inheritedCodes: ['native', 'overlap'],
  }
}

function render() {
  const pinia = createPinia()
  const session = useSessionStore(pinia)
  session.session = {
    authenticated: true,
    user: { id: 'admin', account: 'admin', name: 'Administrator' },
    roles: ['ACCOUNT_ADMIN'],
    capabilities: ['application-access:write'],
    csrfToken: 'csrf-menu',
  }
  return shallowMount(MenuPermissionDialog, {
    props: { userId: 'user-1', access },
    global: {
      plugins: [pinia],
      stubs: {
        ElDialog: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
        ElButton: {
          template: '<button type="button" @click="$emit(\'click\')"><slot></slot></button>',
        },
      },
    },
  })
}

describe('menu permission dialog', () => {
  it('loads localized tree data and keeps inherited overlap in the managed replacement', async () => {
    vi.spyOn(accountApi, 'getUserApplicationMenuPermissions').mockResolvedValue(snapshot())
    const replace = vi
      .spyOn(accountApi, 'replaceUserApplicationMenuPermissions')
      .mockResolvedValue({ ...snapshot(), permissionRevision: 'permission-2' })
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
    setLocale('en-US')
    const wrapper = render()

    await wrapper.findAll('button')[0]?.trigger('click')
    await flushPromises()
    const tree = wrapper.getComponent(ElTree)
    const data = tree.props('data') as Array<{ label: string; disabled: boolean; code: string }>
    expect(data.map((node) => node.label)).toEqual(['Managed menu', 'Native menu', 'Overlap'])
    expect(data.find((node) => node.code === 'native')?.disabled).toBe(true)
    expect(tree.props('defaultCheckedKeys')).toEqual(['managed', 'overlap', 'native'])

    tree.vm.$emit('check', data[0], { checkedKeys: ['native', 'overlap'] })
    const save = wrapper.findAll('button').find((button) => button.text() === enUS.common.save)
    await save?.trigger('click')
    await flushPromises()

    expect(replace).toHaveBeenCalledWith(
      'user-1',
      'app-1',
      {
        expectedAccessVersion: 7,
        expectedCatalogRevision: 'catalog-1',
        expectedPermissionRevision: 'permission-1',
        selectedCodes: ['overlap'],
      },
      'csrf-menu',
      '00000000-0000-4000-8000-000000000001',
    )
    expect(wrapper.text()).toContain(enUS.menuPermissions.saved)
  })

  it('requires reload after a revision conflict and never shows success', async () => {
    vi.spyOn(accountApi, 'getUserApplicationMenuPermissions').mockResolvedValue(snapshot())
    vi.spyOn(accountApi, 'replaceUserApplicationMenuPermissions').mockRejectedValue(
      new ApiError(409, {
        code: 'PERMISSION_REVISION_CONFLICT',
        message: 'conflict',
        traceId: 'trace-1',
      }),
    )
    const wrapper = render()

    await wrapper.findAll('button')[0]?.trigger('click')
    await flushPromises()
    const save = wrapper.findAll('button').find((button) => button.text() === '保存')
    await save?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('权限目录或用户权限已被其他操作更新')
    expect(wrapper.text()).not.toContain('菜单权限已由应用确认并保存')
  })
})
