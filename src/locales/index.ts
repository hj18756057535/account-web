import { reactive, readonly, ref } from 'vue'
import { enUS } from './en-US'
import { zhCN } from './zh-CN'
import type { Messages } from './types'

export type Locale = 'zh-CN' | 'en-US'
const storageKey = 'account-console.locale'
const currentLocale = ref<Locale>('zh-CN')
export const locale = readonly(currentLocale)
const currentMessages = reactive<Messages>(structuredClone(zhCN))
export const messages = readonly(currentMessages)

function replaceMessages(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') target[key] = value
    else replaceMessages(target[key] as Record<string, unknown>, value as Record<string, unknown>)
  }
}

export function setLocale(value: string) {
  if (value !== 'zh-CN' && value !== 'en-US') return
  currentLocale.value = value
  // Preserve namespace references held by mounted forms; do not remount or lose input.
  replaceMessages(currentMessages, value === 'en-US' ? enUS : zhCN)
  document.documentElement.lang = value
  document.documentElement.dir = 'ltr'
  document.title = messages.brand.product
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // Language switching remains available when browser storage is disabled.
  }
}

export function initializeLocale() {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(storageKey)
  } catch {
    // Default to Chinese if browser storage cannot be read.
  }
  setLocale(saved === 'en-US' ? 'en-US' : 'zh-CN')
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat(locale.value).format(value)
}

export function formatDate(value?: string | null) {
  if (!value) return messages.common.unknown
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return messages.common.unknown
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

// Existing forms store translated feedback strings. Resolve them against both catalogs
// at render time so a language switch also updates already-visible validation errors.
function feedbackEntries(catalog: Record<string, unknown>, prefix = ''): [string, string[]][] {
  return Object.entries(catalog).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string'
      ? [[value, path.split('.')]]
      : feedbackEntries(value as Record<string, unknown>, path)
  })
}

const feedbackPaths = new Map([...feedbackEntries(zhCN), ...feedbackEntries(enUS)])

export function localizeFeedback(value?: string) {
  if (!value) return ''
  const path = feedbackPaths.get(value)
  if (!path) return messages.common.invalidField
  let translated: unknown = messages
  for (const key of path) translated = (translated as Record<string, unknown>)[key]
  return String(translated)
}
