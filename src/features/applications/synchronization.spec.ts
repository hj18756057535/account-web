import { afterEach, describe, expect, it } from 'vitest'
import { messages, setLocale } from '@/locales'
import { synchronizationError } from './synchronization'

describe('application synchronization feedback', () => {
  afterEach(() => setLocale('zh-CN'))

  it('translates states and safe error codes without displaying remote content', () => {
    setLocale('zh-CN')
    expect(messages.access.syncStates.succeeded).toBe('应用已确认')
    expect(synchronizationError('SYNC_IDENTITY_CONFLICT')).toContain('映射冲突')
    expect(synchronizationError('remote-secret')).not.toContain('remote-secret')
    setLocale('en-US')
    expect(messages.access.syncStates.succeeded).toBe('Confirmed by application')
    expect(synchronizationError('SYNC_IDENTITY_CONFLICT')).toContain('mapping conflicts')
    expect(synchronizationError('SYNC_TARGET_CHANGED')).toContain('configuration changed')
    expect(synchronizationError('SYNC_EXPIRED')).toContain('expired')
  })
})
