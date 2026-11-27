import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElSelect, ElTree } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as accountApi from '@/api/account'
import { ApiError } from '@/api/http'
import { useSessionStore } from '@/features/session/session.store'
import { enUS } from '@/locales/en-US'
import { setLocale } from '@/locales'

import UserPermissionEditor from './UserPermissionEditor.vue'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.restoreAllMocks()
  setLocale('zh-CN')
})

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
  return shallowMount(UserPermissionEditor, {
    props: { userId: 'user-1', appCode: 'app-1' },
    global: {
      plugins: [pinia],
      stubs: {
        ElButton: {
          template: '<button type="button" @click="$emit(\'click\')"><slot></slot></button>',
        },
      },
    },
  })
}

describe('user permission editor', () => {
  it('assigns existing roles with string IDs without submitting role definitions', async () => {
    const source: accountApi.MenuPermissionResponse = {
      ...snapshot(),
      roles: [
        { localRoleId: '9007199254740993', code: 'editor', name: 'Editor', status: 'enabled' },
      ],
      selectedRoleIds: [],
    }
    vi.spyOn(accountApi, 'getUserApplicationMenuPermissions').mockResolvedValue(source)
    const replace = vi
      .spyOn(accountApi, 'replaceUserApplicationMenuPermissions')
      .mockResolvedValue({
        ...source,
        selectedRoleIds: ['9007199254740993'],
      })
    const wrapper = render()
    await flushPromises()
    wrapper.getComponent(ElSelect).vm.$emit('update:modelValue', ['9007199254740993'])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存授权')
      ?.trigger('click')
    await flushPromises()
    const payload = replace.mock.calls[0]![2]
    expect(payload.selectedRoleIds).toEqual(['9007199254740993'])
    expect(payload.selectedCodes).toEqual(['managed', 'overlap'])
    expect(payload).not.toHaveProperty('roles')
    expect(payload).not.toHaveProperty('nodes')
  })

  it('keeps role-only applications writable without a menu catalog', async () => {
    const source: accountApi.MenuPermissionResponse = {
      ...snapshot(),
      nodes: [],
      selectedCodes: [],
      inheritedCodes: [],
      roles: [{ localRoleId: '7', code: 'reader', name: 'Reader', status: 'enabled' }],
      selectedRoleIds: [],
    }
    vi.spyOn(accountApi, 'getUserApplicationMenuPermissions').mockResolvedValue(source)
    const replace = vi
      .spyOn(accountApi, 'replaceUserApplicationMenuPermissions')
      .mockResolvedValue(source)
    const wrapper = render()
    await flushPromises()
    wrapper.getComponent(ElSelect).vm.$emit('update:modelValue', ['7'])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存授权')
      ?.trigger('click')
    await flushPromises()
    expect(replace.mock.calls[0]![2]).toMatchObject({ selectedCodes: [], selectedRoleIds: ['7'] })
  })

  it('saves CMS roles while keeping the application menu catalog read-only', async () => {
    const source: accountApi.MenuPermissionResponse = {
      ...snapshot(),
      nodes: snapshot().nodes.map((node) => ({ ...node, assignable: false })),
      selectedCodes: [],
      inheritedCodes: ['native'],
      roles: [{ localRoleId: '7', code: 'reader', name: 'Reader', status: 'enabled' }],
      selectedRoleIds: [],
    }
    vi.spyOn(accountApi, 'getUserApplicationMenuPermissions').mockResolvedValue(source)
    const replace = vi
      .spyOn(accountApi, 'replaceUserApplicationMenuPermissions')
      .mockResolvedValue({ ...source, selectedRoleIds: ['7'] })
    const wrapper = render()
    await flushPromises()
    const nodes = wrapper.getComponent(ElTree).props('data') as Array<{ disabled: boolean }>
    expect(nodes.every((node) => node.disabled)).toBe(true)
    wrapper.getComponent(ElSelect).vm.$emit('update:modelValue', ['7'])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存授权')!
      .trigger('click')
    await flushPromises()
    expect(replace.mock.calls[0]![2]).toMatchObject({ selectedCodes: [], selectedRoleIds: ['7'] })
  })

  it('loads localized tree data and keeps inherited overlap in the managed replacement', async () => {
    vi.spyOn(accountApi, 'getUserApplicationMenuPermissions').mockResolvedValue(snapshot())
    const replace = vi
      .spyOn(accountApi, 'replaceUserApplicationMenuPermissions')
      .mockResolvedValue({ ...snapshot(), permissionRevision: 'permission-2' })
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
    setLocale('en-US')
    const wrapper = render()

    await flushPromises()
    const tree = wrapper.getComponent(ElTree)
    expect(wrapper.findComponent(ElSelect).exists()).toBe(false)
    const data = tree.props('data') as Array<{ label: string; disabled: boolean; code: string }>
    expect(data.map((node) => node.label)).toEqual(['Managed menu', 'Native menu', 'Overlap'])
    expect(data.find((node) => node.code === 'native')?.disabled).toBe(true)
    expect(tree.props('defaultCheckedKeys')).toEqual(['managed', 'overlap', 'native'])

    tree.vm.$emit('check', data[0], { checkedKeys: ['native', 'overlap'] })
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === enUS.menuPermissions.save)
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

  it('discards an earlier save when the authorization target changes', async () => {
    vi.spyOn(accountApi, 'getUserApplicationMenuPermissions').mockResolvedValue(snapshot())
    let resolve: (value: accountApi.MenuPermissionResponse) => void = () => {}
    vi.spyOn(accountApi, 'replaceUserApplicationMenuPermissions').mockReturnValue(
      new Promise((done) => (resolve = done)),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存授权')!
      .trigger('click')
    await wrapper.setProps({ userId: 'user-2', appCode: 'app-2' })
    await flushPromises()
    resolve({ ...snapshot(), permissionRevision: 'old-target-save' })
    await flushPromises()
    expect(accountApi.getUserApplicationMenuPermissions).toHaveBeenLastCalledWith('user-2', 'app-2')
    expect(wrapper.text()).not.toContain('应用授权已由应用确认并保存')
    expect(wrapper.findAll('button').some((button) => button.text() === '保存授权')).toBe(true)
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

    await flushPromises()
    const save = wrapper.findAll('button').find((button) => button.text() === '保存授权')
    await save?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('权限目录或用户权限已被其他操作更新')
    expect(wrapper.text()).not.toContain('应用授权已由应用确认并保存')
  })
})
