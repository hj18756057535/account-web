import { defineComponent, inject, provide } from 'vue'
import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '@/api/account'
import { useSessionStore } from '@/features/session/session.store'
import { messages } from '@/locales'
import UserListView from './UserListView.vue'

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

const user: api.UserResponse = {
  id: 'global-alice',
  account: 'alice',
  name: 'Alice',
  email: 'alice@example.test',
  phone: '',
  status: 'enabled',
  version: 1,
}

async function render(canAuthorize = true) {
  vi.spyOn(api, 'listUsers').mockResolvedValue({ items: [user], page: 1, size: 20, total: 1 })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/users', name: 'users', component: UserListView },
      { path: '/users/:userId', name: 'user-detail', component: { template: '<div />' } },
      {
        path: '/user-authorization',
        name: 'user-authorization',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/users')
  const pinia = createPinia()
  vi.spyOn(useSessionStore(pinia), 'hasCapability').mockImplementation(
    (capability) =>
      capability === 'users:read' || (capability === 'application-access:read' && canAuthorize),
  )
  const wrapper = shallowMount(UserListView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        RouterLink: false,
        ElTable: defineComponent({
          inheritAttrs: false,
          props: ['data'],
          setup(props, { slots }) {
            provide('tableRows', props.data)
            return () => slots.default?.()
          },
        }),
        ElTableColumn: defineComponent({
          inheritAttrs: false,
          setup(_props, { slots }) {
            const rows = inject<api.UserResponse[]>('tableRows', [])
            return () => rows.map((row) => slots.default?.({ row }))
          },
        }),
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('user list authorization entry', () => {
  it('opens user authorization with the selected global user ID', async () => {
    const { wrapper, router } = await render()
    const link = wrapper
      .findAllComponents(RouterLink)
      .find((item) => item.text() === messages.common.authorize)!
    await router.push(link.props('to'))
    expect(router.currentRoute.value).toMatchObject({
      name: 'user-authorization',
      query: { userId: 'global-alice' },
    })
  })

  it('only offers authorization to administrators with access to that page', async () => {
    const { wrapper } = await render(false)
    const links = wrapper.findAllComponents(RouterLink)
    expect(links.some((item) => item.text() === messages.common.authorize)).toBe(false)
    expect(links.some((item) => item.text() === messages.common.view)).toBe(true)
  })
})
