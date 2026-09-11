import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '@/locales'

import {
  changeUserApplicationAccess,
  createApplication,
  createUser,
  getAuditEvent,
  getUserApplicationMenuPermissions,
  listAuditEvents,
  previewUserImport,
  commitUserImport,
  downloadUserImportTemplate,
  retryUserApplicationSynchronization,
  replaceUserApplicationMenuPermissions,
} from './account'

describe('account write client', () => {
  it('queries and replaces menu permissions through Account with encoded paths and write guards', async () => {
    const snapshot = {
      accessVersion: 7,
      catalogRevision: 'catalog-1',
      permissionRevision: 'permission-1',
      assignmentMode: 'ADDITIVE',
      nodes: [],
      selectedCodes: [],
      inheritedCodes: [],
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(snapshot), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await getUserApplicationMenuPermissions('user/1', 'app one')
    await replaceUserApplicationMenuPermissions(
      'user/1',
      'app one',
      {
        expectedAccessVersion: 7,
        expectedCatalogRevision: 'catalog-1',
        expectedPermissionRevision: 'permission-1',
        selectedCodes: ['menu:view'],
      },
      'csrf-menu',
      'idem-menu',
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/users/user%2F1/applications/app%20one/menu-permissions',
    )
    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/api/users/user%2F1/applications/app%20one/menu-permissions')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(String(options.body))).toMatchObject({
      expectedAccessVersion: 7,
      expectedCatalogRevision: 'catalog-1',
      expectedPermissionRevision: 'permission-1',
      selectedCodes: ['menu:view'],
    })
    const headers = new Headers(options.headers)
    expect(headers.get('X-CSRF-Token')).toBe('csrf-menu')
    expect(headers.get('Idempotency-Key')).toBe('idem-menu')
  })

  it('retries synchronization with version and security headers', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ version: 7, integrationStatus: 'pending' }), { status: 202 }),
      )
    vi.stubGlobal('fetch', fetchMock)
    await retryUserApplicationSynchronization('user/1', 'app-1', 7, 'csrf-sync', 'sync-retry-1')
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/users/user%2F1/applications/app-1/synchronizations')
    expect(options.method).toBe('POST')
    expect(JSON.parse(String(options.body))).toEqual({ expectedVersion: 7 })
    expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('csrf-sync')
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe('sync-retry-1')
  })
  it('uploads multipart with security headers and downloads binary without JSON decoding', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ importId: 'batch-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ createdCount: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response('synthetic-xlsx', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    setLocale('en-US')
    const file = new File(['synthetic'], 'users.xlsx')
    await previewUserImport(file, 'csrf-import', 'upload-key')
    await commitUserImport('batch/1', 'csrf-import', 'commit-key')
    const blob = await downloadUserImportTemplate()
    const options = fetchMock.mock.calls[0]?.[1]
    expect(options?.body).toBeInstanceOf(FormData)
    if (!(options?.body instanceof FormData)) throw new Error('Expected multipart body')
    expect(options.body.get('file')).toBe(file)
    const headers = new Headers(options?.headers)
    expect(headers.has('Content-Type')).toBe(false)
    expect(headers.get('X-CSRF-Token')).toBe('csrf-import')
    expect(headers.get('Idempotency-Key')).toBe('upload-key')
    expect(headers.get('Accept-Language')).toBe('en-US')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/user-imports/batch%2F1/commit')
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('Idempotency-Key')).toBe(
      'commit-key',
    )
    expect(await blob.text()).toBe('synthetic-xlsx')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setLocale('zh-CN')
  })

  it('encodes exact audit filters and detail identifiers without write headers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      return new Response(JSON.stringify({ items: [], page: 2, size: 20, total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    setLocale('en-US')
    await listAuditEvents({ page: 2, size: 20, operatorId: '', traceId: 'a&b /中文' })
    setLocale('zh-CN')
    await getAuditEvent('event/a b')

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url, 'https://account.example.test')
    expect(parsed.pathname).toBe('/api/audit-events')
    expect(parsed.searchParams.get('traceId')).toBe('a&b /中文')
    expect(parsed.searchParams.get('page')).toBe('2')
    expect(parsed.searchParams.has('operatorId')).toBe(false)
    expect(new Headers(options.headers).has('Idempotency-Key')).toBe(false)
    expect(new Headers(options.headers).get('Accept-Language')).toBe('en-US')
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('Accept-Language')).toBe('zh-CN')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/audit-events/event%2Fa%20b')
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
      { status: 'enabled', version: 0, reason: '测试开通', confirmPermissionReuse: false },
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
