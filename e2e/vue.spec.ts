import { test, expect } from '@playwright/test'

test('shows the secure login recovery state when Account API is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.route('**/api/session', (route) => route.abort())
  await page.goto('/console/login')

  await expect(page.getByRole('heading', { name: '登录账号管理端' })).toBeVisible()
  await expect(page.getByText('暂时无法连接 Account 服务')).toBeVisible()
})

test('opens the authenticated user directory with contract-shaped data', async ({ page }) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 'synthetic-admin', account: 'admin', name: '测试管理员' },
        roles: ['ACCOUNT_ADMIN'],
        capabilities: ['users:read'],
        csrfToken: 'synthetic-csrf-token-for-browser-test',
      }),
    }),
  )
  await page.route('**/api/users?**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'synthetic-user',
            account: 'zhangsan',
            email: 'zhangsan@example.test',
            name: '张三',
            phone: '13800000000',
            status: 'enabled',
            version: 1,
            createdAt: '2026-08-20T00:00:00Z',
            updatedAt: '2026-08-20T00:00:00Z',
          },
        ],
        page: 1,
        size: 20,
        total: 1,
      }),
    }),
  )

  await page.goto('/console/users')

  await expect(page.getByRole('heading', { name: '全局用户' })).toBeVisible()
  await expect(page.getByText('zhangsan', { exact: true })).toBeVisible()
  await expect(page.getByText('张三')).toBeVisible()
})

test('creates, edits, and disables a global user with protected write requests', async ({
  page,
}) => {
  const session = {
    authenticated: true,
    user: { id: 'synthetic-admin', account: 'admin', name: '测试管理员' },
    roles: ['ACCOUNT_ADMIN'],
    capabilities: ['users:read', 'users:write'],
    csrfToken: 'synthetic-csrf-token-for-write-test',
  }
  let storedUser = {
    id: 'synthetic-user',
    account: 'zhangsan',
    email: 'zhangsan@example.test',
    name: '张三',
    phone: '13800000000',
    status: 'enabled',
    version: 1,
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
  }
  const writeRequests: Array<{
    method: string
    headers: Record<string, string>
    body: unknown
  }> = []

  await page.route('**/api/session', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(session) }),
  )
  await page.route('**/api/users**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (method === 'GET' && url.pathname.endsWith('/users')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [], page: 1, size: 20, total: 0 }),
      })
      return
    }
    if (method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(storedUser),
      })
      return
    }

    writeRequests.push({ method, headers: request.headers(), body: request.postDataJSON() })
    if (method === 'POST') {
      storedUser = { ...storedUser, ...(request.postDataJSON() as object) }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(storedUser),
      })
      return
    }
    if (url.pathname.endsWith('/status')) {
      storedUser = { ...storedUser, status: 'disabled', version: 3 }
    } else {
      storedUser = { ...storedUser, ...(request.postDataJSON() as object), version: 2 }
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(storedUser),
    })
  })

  await page.goto('/console/users')
  await page.getByRole('link', { name: '新建用户' }).click()
  await page.getByLabel('账号').fill('zhangsan')
  await page.getByLabel('姓名').fill('张三')
  await page.getByLabel('邮箱').fill('zhangsan@example.test')
  await page.getByLabel('手机号').fill('13800000000')
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page.getByText('用户资料已保存')).toBeVisible()
  await page.getByRole('link', { name: '编辑' }).click()
  await page.getByLabel('姓名').fill('张三（已编辑）')
  await page.getByRole('button', { name: '保存' }).click()

  await page.getByLabel('变更原因').fill('离职账号停用')
  await page.getByRole('button', { name: '禁用用户' }).click()
  await page.getByRole('button', { name: '确认操作' }).click()
  await expect(page.getByText('已禁用').first()).toBeVisible()

  expect(writeRequests).toHaveLength(3)
  for (const request of writeRequests) {
    expect(request.headers['x-csrf-token']).toBe(session.csrfToken)
    expect(request.headers['idempotency-key']).toBeTruthy()
  }
  expect(writeRequests[1]?.body).toMatchObject({ version: 1, name: '张三（已编辑）' })
  expect(writeRequests[2]?.body).toMatchObject({ version: 2, status: 'disabled' })
})

test('registers an application, reveals its secret once, and records pending access intent', async ({
  page,
}) => {
  test.setTimeout(15_000)
  const session = {
    authenticated: true,
    user: { id: 'synthetic-admin', account: 'admin', name: '测试管理员' },
    roles: ['ACCOUNT_ADMIN'],
    capabilities: [
      'users:read',
      'users:write',
      'applications:read',
      'applications:write',
      'application-access:read',
      'application-access:write',
    ],
    csrfToken: 'synthetic-csrf-token-for-application-test',
  }
  const application = {
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
    protocolCapabilities: ['sso', 'admin_ticket', 'user_sync'],
    createdAt: '2026-09-02T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
  }
  const user = {
    id: 'synthetic-user',
    account: 'zhangsan',
    email: 'zhangsan@example.test',
    name: '张三',
    phone: '13800000000',
    status: 'enabled',
    version: 1,
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
  }
  let access = {
    userId: user.id,
    appCode: application.appCode,
    applicationName: application.name,
    applicationStatus: 'enabled',
    desiredStatus: 'disabled',
    version: 0,
    integrationStatus: 'pending_application_adaptation',
    syncCommandId: null,
    updatedAt: null,
  }
  const writes: Array<{ path: string; headers: Record<string, string>; body: unknown }> = []

  await page.route('**/api/session', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(session) }),
  )
  await page.route('**/api/applications**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'POST' && url.pathname.endsWith('/applications')) {
      writes.push({
        path: url.pathname,
        headers: request.headers(),
        body: request.postDataJSON(),
      })
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          application,
          secret: 'synthetic-one-time-secret-not-a-real-credential',
        }),
      })
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(url.pathname.endsWith('/applications') ? [] : application),
    })
  })
  await page.route('**/api/users/synthetic-user**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.includes('/application-access')) {
      if (request.method() === 'PUT') {
        writes.push({
          path: url.pathname,
          headers: request.headers(),
          body: request.postDataJSON(),
        })
        access = {
          ...access,
          desiredStatus: 'enabled',
          version: 1,
          syncCommandId: 'synthetic-sync-command',
          updatedAt: '2026-09-02T00:01:00Z',
        }
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify(access),
        })
        return
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([access]) })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) })
  })

  await page.goto('/console/applications')
  await page.getByRole('link', { name: '登记应用' }).click()
  await page.getByLabel('应用编码').fill(application.appCode)
  await page.getByLabel('应用名称').fill(application.name)
  await page.getByLabel('入口地址').fill(application.entryUrl)
  await page.getByLabel('SSO 精确回调地址').fill(application.ssoCallbackUrl)
  await page.getByLabel('授权页地址').fill(application.permissionIframeUrl)
  await page.getByLabel('用户同步通知地址').fill(application.notifyBaseUrl)
  await page.getByRole('button', { name: '保存' }).click()

  const secretDialog = page.getByRole('dialog', { name: '请立即安全保存 Secret' })
  await expect(secretDialog).toBeVisible()
  await expect(secretDialog.getByRole('textbox')).toHaveValue(
    'synthetic-one-time-secret-not-a-real-credential',
  )
  await page.getByRole('button', { name: '确认操作' }).click()
  await expect(secretDialog).toBeHidden()
  await expect(page.getByRole('heading', { name: application.name })).toBeVisible()

  await page.goto('/console/users/synthetic-user')
  await expect(page.getByRole('heading', { name: '应用准入期望状态' })).toBeVisible()
  await expect(page.getByText('待应用适配')).toBeVisible()
  await page.getByPlaceholder('请填写准入变更原因').fill('浏览器验收开通')
  await page.getByRole('button', { name: '期望启用' }).click()
  await expect(page.getByText('准入期望状态已保存，等待应用适配')).toBeVisible()

  expect(writes).toHaveLength(2)
  for (const request of writes) {
    expect(request.headers['x-csrf-token']).toBe(session.csrfToken)
    expect(request.headers['idempotency-key']).toBeTruthy()
  }
  expect(writes[1]?.body).toMatchObject({ status: 'enabled', version: 0 })
})

test('returns safely to login when the user directory reports an expired session', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 'synthetic-admin', account: 'admin', name: '测试管理员' },
        roles: ['ACCOUNT_ADMIN'],
        capabilities: ['users:read'],
        csrfToken: 'synthetic-csrf-token-for-expiry-test',
      }),
    }),
  )
  await page.route('**/api/users?**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'synthetic expired session',
        traceId: 'synthetic-trace',
      }),
    }),
  )

  await page.goto('/console/users')

  await expect(page).toHaveURL(/\/console\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: '登录账号管理端' })).toBeVisible()
})
