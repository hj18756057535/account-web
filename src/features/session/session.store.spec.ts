import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import {
  getSession,
  login as loginRequest,
  logout as logoutRequest,
  type SessionResponse,
} from '@/api/account'
import { useSessionStore } from './session.store'

vi.mock('@/api/account', () => ({
  getSession: vi.fn<typeof getSession>(),
  login: vi.fn<typeof loginRequest>(),
  logout: vi.fn<typeof logoutRequest>(),
}))

const anonymousSession: SessionResponse = {
  authenticated: false,
  user: null,
  roles: [],
  capabilities: [],
  csrfToken: 'csrf-token-for-test-session',
}

const authenticatedSession: SessionResponse = {
  authenticated: true,
  user: { id: 'synthetic-admin', account: 'admin', name: '测试管理员' },
  roles: ['ACCOUNT_ADMIN'],
  capabilities: ['users:read', 'users:write'],
  csrfToken: 'csrf-token-for-test-session',
}

describe('session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getSession).mockReset()
    vi.mocked(loginRequest).mockReset()
    vi.mocked(logoutRequest).mockReset()
  })

  it('keeps the csrf token in memory and exposes server capabilities', async () => {
    vi.mocked(getSession).mockResolvedValue(anonymousSession)
    vi.mocked(loginRequest).mockResolvedValue(authenticatedSession)
    const store = useSessionStore()

    await store.initialize()
    await store.login({ account: 'admin', password: 'synthetic-password' })

    expect(loginRequest).toHaveBeenCalledWith(
      { account: 'admin', password: 'synthetic-password' },
      anonymousSession.csrfToken,
    )
    expect(store.authenticated).toBe(true)
    expect(store.hasCapability('users:read')).toBe(true)
    expect(store.hasCapability('users:write')).toBe(true)
    expect(localStorage).toHaveLength(0)
    expect(sessionStorage).toHaveLength(0)
  })

  it('clears local session state after server logout', async () => {
    vi.mocked(getSession).mockResolvedValue(authenticatedSession)
    vi.mocked(logoutRequest).mockResolvedValue(undefined)
    const store = useSessionStore()

    await store.initialize()
    await store.logout()

    expect(logoutRequest).toHaveBeenCalledWith(authenticatedSession.csrfToken)
    expect(store.authenticated).toBe(false)
    expect(store.initialized).toBe(false)
  })
})
