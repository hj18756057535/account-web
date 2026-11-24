import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ElInput } from 'element-plus'

import * as accountApi from '@/api/account'
import StatePanel from '@/components/StatePanel.vue'
import { zhCN } from '@/locales/zh-CN'

import ApplicationFormView from './ApplicationFormView.vue'

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

async function renderEditor(path = '/applications/demo-app/edit') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/applications', name: 'applications', component: ApplicationFormView },
      {
        path: '/applications/new',
        name: 'application-create',
        component: ApplicationFormView,
      },
      {
        path: '/applications/:appCode',
        name: 'application-detail',
        component: ApplicationFormView,
      },
      {
        path: '/applications/:appCode/edit',
        name: 'application-edit',
        component: ApplicationFormView,
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  return shallowMount(ApplicationFormView, {
    global: {
      plugins: [createPinia(), router],
      stubs: { RouterLink: false, ElCheckbox: false, ElCheckboxGroup: false },
    },
  })
}

describe('application editor route rendering', () => {
  it('registers an application without feature switches or optional addresses', async () => {
    vi.spyOn(accountApi, 'createApplication').mockResolvedValue({
      application: {
        appCode: 'plain-app',
        name: 'Plain',
        entryUrl: '',
        ssoCallbackUrl: '',
        permissionIframeUrl: '',
        notifyBaseUrl: '',
        defaultTenantCode: 'default',
        protocolCapabilities: [],
        status: 'enabled',
        secretState: 'active',
        secretVersion: 1,
        version: 1,
      },
      secret: 'synthetic-secret-only-for-unit-testing',
    })
    const wrapper = await renderEditor('/applications/new')
    const inputs = wrapper.findAllComponents(ElInput)
    inputs[0]!.vm.$emit('update:modelValue', 'plain-app')
    inputs[1]!.vm.$emit('update:modelValue', 'Plain')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(accountApi.createApplication).toHaveBeenCalledOnce()
    expect(vi.mocked(accountApi.createApplication).mock.calls[0]![0]).not.toHaveProperty(
      'protocolCapabilities',
    )
    expect(wrapper.find('fieldset').exists()).toBe(false)
  })

  it('renders the back link before application data has loaded', async () => {
    vi.spyOn(accountApi, 'getApplication').mockReturnValue(new Promise(() => {}))

    const wrapper = await renderEditor()

    expect(wrapper.get('.back-link').attributes('href')).toBe('/applications/demo-app')
    expect(wrapper.find('el-skeleton-stub').exists()).toBe(true)
    expect(accountApi.getApplication).toHaveBeenCalledWith('demo-app')
  })

  it('keeps the back link and error panel when application loading fails', async () => {
    vi.spyOn(accountApi, 'getApplication').mockRejectedValue(new Error('unavailable'))

    const wrapper = await renderEditor()
    await flushPromises()

    expect(wrapper.get('.back-link').attributes('href')).toBe('/applications/demo-app')
    expect(wrapper.getComponent(StatePanel).props('title')).toBe(zhCN.applications.loadFailed)
  })

  it('renders the editing form after application loading succeeds', async () => {
    vi.spyOn(accountApi, 'getApplication').mockResolvedValue({
      appCode: 'demo-app',
      name: 'Demo',
      entryUrl: 'https://example.test',
      ssoCallbackUrl: 'https://example.test/callback',
      permissionIframeUrl: 'https://example.test/permissions',
      notifyBaseUrl: 'https://example.test/notify',
      defaultTenantCode: 'default',
      protocolCapabilities: ['sso'],
      status: 'enabled',
      version: 1,
      secretVersion: 1,
      secretState: 'active',
      createdAt: '2026-09-04T00:00:00Z',
      updatedAt: null,
    })

    const wrapper = await renderEditor()
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.get('.back-link').attributes('href')).toBe('/applications/demo-app')
    const inputsBefore = wrapper
      .findAllComponents(ElInput)
      .map((input) => input.props('modelValue'))
    expect(inputsBefore).toContain('Demo')
    await wrapper.get('el-button-stub').trigger('click')
    expect(wrapper.findAllComponents(ElInput).map((input) => input.props('modelValue'))).toEqual(
      inputsBefore,
    )
    expect(wrapper.find('fieldset').exists()).toBe(false)
  })
})
