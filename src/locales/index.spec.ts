import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { enUS } from './en-US'
import { zhCN } from './zh-CN'
import {
  formatDate,
  formatNumber,
  initializeLocale,
  locale,
  localizeFeedback,
  messages,
  setLocale,
} from './index'

afterEach(() => {
  vi.restoreAllMocks()
  setLocale('zh-CN')
  localStorage.clear()
})

function leaves(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const path = `${prefix}${key}`
      return typeof entry === 'string'
        ? [[path, entry]]
        : Object.entries(leaves(entry as Record<string, unknown>, `${path}.`))
    }),
  )
}

describe('bilingual console', () => {
  it('keeps translation keys and interpolation parameters in sync', () => {
    const source = leaves(zhCN)
    const target = leaves(enUS)
    expect(Object.keys(target).sort()).toEqual(Object.keys(source).sort())
    for (const [key, value] of Object.entries(source)) {
      expect(target[key]?.trim()).toBeTruthy()
      expect(target[key]?.match(/\{\w+\}/g) ?? []).toEqual(value.match(/\{\w+\}/g) ?? [])
    }
  })

  it('updates mounted namespaces without losing unsaved input', async () => {
    const wrapper = mount({
      setup: () => ({ copy: messages.users }),
      template: '<div><h1>{{ copy.title }}</h1><input value="unsaved" /></div>',
    })
    const input = wrapper.get('input').element
    setLocale('en-US')
    await nextTick()
    expect(wrapper.get('h1').text()).toBe(enUS.users.title)
    expect(wrapper.get('input').element).toBe(input)
    expect(wrapper.get('input').element.value).toBe('unsaved')
    expect(document.documentElement.lang).toBe('en-US')
    expect(document.title).toBe(enUS.brand.product)
    expect(localizeFeedback(zhCN.users.required)).toBe(enUS.users.required)
    expect(localizeFeedback('unrecognized backend message')).toBe(enUS.common.invalidField)
    wrapper.unmount()
  })

  it('restores preferences, rejects unsupported locales and tolerates storage failures', () => {
    localStorage.setItem('account-console.locale', 'en-US')
    initializeLocale()
    expect(locale.value).toBe('en-US')
    setLocale('unsupported')
    expect(locale.value).toBe('en-US')
    localStorage.setItem('account-console.locale', 'unsupported')
    initializeLocale()
    expect(locale.value).toBe('zh-CN')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(() => setLocale('en-US')).not.toThrow()
    expect(locale.value).toBe('en-US')
  })

  it('formats dates and numbers with the selected locale', () => {
    setLocale('en-US')
    expect(formatNumber(12345)).toBe(new Intl.NumberFormat('en-US').format(12345))
    expect(formatDate('2026-09-04T12:00:00Z')).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(
        new Date('2026-09-04T12:00:00Z'),
      ),
    )
    expect(formatDate(null)).toBe('—')
    expect(formatDate('invalid')).toBe('—')
  })
})
