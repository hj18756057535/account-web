import { afterEach, describe, expect, it, vi } from 'vitest'

import { createUser } from './account'

describe('account write client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends csrf and idempotency headers with a create request', async () => {
    const responseBody = {
      id: 'user-1',
      account: 'zhangsan',
      email: 'zhangsan@example.test',
      name: '张三',
      phone: '13800000000',
      status: 'enabled' as const,
      version: 1,
      createdAt: '2026-08-20T00:00:00Z',
      updatedAt: '2026-08-20T00:00:00Z',
    }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createUser(
      {
        account: 'zhangsan',
        email: 'zhangsan@example.test',
        name: '张三',
        phone: '13800000000',
      },
      'csrf-token',
      'idempotency-key',
    )

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(options.headers)
    expect(url).toBe('/api/users')
    expect(options.method).toBe('POST')
    expect(headers.get('X-CSRF-Token')).toBe('csrf-token')
    expect(headers.get('Idempotency-Key')).toBe('idempotency-key')
    expect(JSON.parse(String(options.body))).toMatchObject({ account: 'zhangsan' })
  })
})
