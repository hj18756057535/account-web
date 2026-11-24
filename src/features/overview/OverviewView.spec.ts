import { createPinia } from 'pinia'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '@/api/account'
import { ApiError } from '@/api/http'
import StatePanel from '@/components/StatePanel.vue'
import { setLocale } from '@/locales'
import { enUS } from '@/locales/en-US'
import { zhCN } from '@/locales/zh-CN'

import OverviewView from './OverviewView.vue'

enableAutoUnmount(afterEach)
beforeEach(() => vi.spyOn(api, 'listApplications').mockResolvedValue([]))
afterEach(() => {
  vi.restoreAllMocks()
  setLocale('zh-CN')
})

function snapshot(): api.OverviewResponse {
  return {
    sampledAt: '2026-10-16T00:00:00Z',
    failuresSince: '2026-10-15T00:00:00Z',
    counts: {
      users: 0,
      disabledUsers: 0,
      applications: 0,
      disabledApplications: 0,
      grantedAccess: 0,
      longDisabledUsers: 0,
    },
    recentFailures: 0,
    insightsEnabled: true,
    insights: [],
    failureEvents: [],
    accountDataStatus: 'available',
    downstreamStatus: 'not_checked',
  }
}

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/overview', name: 'overview', component: OverviewView },
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/forbidden', name: 'forbidden', component: { template: '<div />' } },
      { path: '/audit-events', name: 'audit-events', component: { template: '<div />' } },
    ],
  })
  await router.push('/overview')
  const wrapper = shallowMount(OverviewView, { global: { plugins: [createPinia(), router] } })
  return { wrapper, router }
}

describe('overview', () => {
  it('shows loading, empty data, and reactive translations', async () => {
    let resolve: (value: api.OverviewResponse) => void = () => {}
    vi.spyOn(api, 'getOverview').mockReturnValue(new Promise((done) => (resolve = done)))
    const { wrapper } = await render()
    expect(wrapper.find('el-skeleton-stub').exists()).toBe(true)
    resolve(snapshot())
    await flushPromises()
    expect(wrapper.text()).toContain(zhCN.overview.empty)
    expect(wrapper.findAll('svg[role="img"]')).toHaveLength(2)
    expect(wrapper.find('.chart-value').attributes('stroke-dasharray')).toBe('0 100')
    setLocale('en-US')
    await flushPromises()
    expect(wrapper.text()).toContain(enUS.overview.userDistribution)
    expect(wrapper.text()).not.toContain(enUS.overview.downstreamUnknown)
  })

  it('retries failures and renders actual status proportions', async () => {
    vi.spyOn(api, 'getOverview')
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue({
        ...snapshot(),
        counts: { ...snapshot().counts, users: 10, disabledUsers: 2 },
        insightsEnabled: false,
      })
    const { wrapper } = await render()
    await flushPromises()
    expect(wrapper.findComponent(StatePanel).props('title')).toBe(zhCN.overview.failed)
    await wrapper.find('el-button-stub').trigger('click')
    await flushPromises()
    expect(wrapper.find('.chart-value').attributes('stroke-dasharray')).toBe('80 100')
    expect(wrapper.find('.chart-legend').text()).toContain('8')
    expect(wrapper.text()).toContain(zhCN.overview.applicationTable)
  })

  it('routes permission failures to the forbidden page', async () => {
    vi.spyOn(api, 'getOverview').mockRejectedValue(
      new ApiError(403, { code: 'ACCESS_DENIED', message: 'denied', traceId: 'trace' }),
    )
    const { router } = await render()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('forbidden')
  })
})
