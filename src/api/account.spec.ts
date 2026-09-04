import { afterEach, describe, expect, it, vi } from 'vitest'

import { changeUserApplicationAccess, createApplication, createUser } from './account'

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

  it('protects application registration and access writes with csrf and idempotency headers', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            application: {
              appCode: 'analytics',
              name: '分析应用',
              entryUrl: 'https://analytics.example.test',
              ssoCallbackUrl: 'https://analytics.example.test/callback',
              permissionIframeUrl: 'https://analytics.example.test/permissions',
              notifyBaseUrl: 'https://analytics.example.test/notify',
              defaultTenantCode: 'default',
              status: 'enabled',
              version: 1,
              secretVersion: 1,
              secretState: 'active',
              protocolCapabilities: ['sso'],
            },
            secret: 'synthetic-one-time-secret',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: 'user-1',
            appCode: 'analytics',
            applicationName: '分析应用',
            applicationStatus: 'enabled',
            desiredStatus: 'enabled',
            version: 1,
            integrationStatus: 'pending_application_adaptation',
            syncCommandId: 'synthetic-command',
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await createApplication(
      {
        appCode: 'analytics',
        name: '分析应用',
        entryUrl: 'https://analytics.example.test',
        ssoCallbackUrl: 'https://analytics.example.test/callback',
        permissionIframeUrl: 'https://analytics.example.test/permissions',
        notifyBaseUrl: 'https://analytics.example.test/notify',
        defaultTenantCode: 'default',
        protocolCapabilities: ['sso'],
      },
      'csrf-app',
      'idempotency-app',
    )
    await changeUserApplicationAccess(
      'user-1',
      'analytics',
      { status: 'enabled', version: 0, reason: '测试开通' },
      'csrf-access',
      'idempotency-access',
    )

    const [applicationUrl, applicationOptions] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [accessUrl, accessOptions] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(applicationUrl).toBe('/api/applications')
    expect(new Headers(applicationOptions.headers).get('X-CSRF-Token')).toBe('csrf-app')
    expect(new Headers(applicationOptions.headers).get('Idempotency-Key')).toBe('idempotency-app')
    expect(accessUrl).toBe('/api/users/user-1/application-access/analytics')
    expect(new Headers(accessOptions.headers).get('X-CSRF-Token')).toBe('csrf-access')
    expect(new Headers(accessOptions.headers).get('Idempotency-Key')).toBe('idempotency-access')
    expect(JSON.parse(String(accessOptions.body))).toMatchObject({ status: 'enabled', version: 0 })
  })
})
